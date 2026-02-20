import { useEffect, useMemo, useState } from 'react';
import { createLazyFileRoute, Link as RouterLink } from '@tanstack/react-router';
import {
  Badge,
  Box,
  Button,
  Container,
  Divider,
  Group,
  Loader,
  Paper,
  Stack,
  Text,
  TextInput,
  Title,
  Tooltip,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { AlertTriangle, Pin, PinOff, Trash2 } from 'lucide-react';

import { RichTextEditor } from '@mantine/tiptap';
import { useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';

import { db } from '../../config/firebase';
import {
  upsertNewsPostCallable,
  updateNewsPostFlagsCallable,
  deleteNewsPostCallable,
} from '../../config/firebase';
import { useAuthStore } from '../../stores/authStore';

import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';

// If your TipTap CSS lives here: src/routes/stories/tiptap.css
// import '../stories/tiptap.css';

export const Route = createLazyFileRoute('/admin/news')({
  component: AdminNewsPage,
});

interface NewsPost {
  id: string;
  title: string;
  previewText: string;
  pinned: boolean;
  isPublished: boolean;
  createdAt: Date | null;
  publishedAt: Date | null;
  updatedAt: Date | null;
  contentJSON: any;
  plainText: string;
}

const EMPTY_DOC = { type: 'doc', content: [{ type: 'paragraph' }] };

function AdminNewsPage() {
  const isAdmin = useAuthStore((s) => s.isAdmin);
  const authLoading = useAuthStore((s) => s.loading);
  const currentUser = useAuthStore((s) => s.user);

  const [posts, setPosts] = useState<NewsPost[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);

  const form = useForm({
    initialValues: {
      title: '',
      pinned: false,
      isPublished: false,
    },
    validate: {
      title: (v) => (v.trim().length < 3 ? 'Title must be at least 3 characters.' : null),
    },
  });

  const [contentJSON, setContentJSON] = useState<any>(EMPTY_DOC);
  const [plainText, setPlainText] = useState('');

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Link.configure({ openOnClick: false }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
    ],
    content: contentJSON,
    onUpdate: ({ editor }) => {
      setContentJSON(editor.getJSON());
      setPlainText(editor.getText());
    },
  });

  // When we programmatically change contentJSON (edit/new), push into TipTap
  useEffect(() => {
    if (!editor) return;
    editor.commands.setContent(contentJSON ?? EMPTY_DOC);
    // Also update plaintext immediately
    setPlainText(editor.getText());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, editingId]);

  // Subscribe to posts (admin only)
  useEffect(() => {
    if (!isAdmin || !currentUser) {
      setPosts([]);
      setLoadingList(false);
      setError(null);
      return;
    }

    setLoadingList(true);
    setError(null);

    const q = query(collection(db, 'newsPosts'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const items: NewsPost[] = snap.docs.map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            title: data.title ?? '(untitled)',
            previewText: data.previewText ?? '',
            pinned: !!data.pinned,
            isPublished: !!data.isPublished,
            contentJSON: data.contentJSON ?? EMPTY_DOC,
            plainText: data.plainText ?? '',
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : null,
            publishedAt: data.publishedAt?.toDate ? data.publishedAt.toDate() : null,
            updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : null,
          };
        });

        // UI-only: pinned first, then newest published/created
        items.sort((a, b) => {
          if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
          const at = (a.publishedAt ?? a.createdAt)?.getTime() ?? 0;
          const bt = (b.publishedAt ?? b.createdAt)?.getTime() ?? 0;
          return bt - at;
        });

        setPosts(items);
        setLoadingList(false);
        setError(null);
      },
      (err) => {
        console.error(err);
        setError('Failed to load news posts.');
        setLoadingList(false);
      }
    );

    return () => unsub();
  }, [isAdmin, currentUser]);

  // Guards
  if (authLoading) {
    return (
      <Container size="lg" py="xl">
        <Group justify="center">
          <Loader />
        </Group>
      </Container>
    );
  }

  if (!isAdmin) {
    return (
      <Container size="md" py="xl">
        <Paper p="lg" radius="lg" withBorder>
          <Group align="flex-start" gap="md">
            <AlertTriangle size={24} />
            <div>
              <Title order={3}>Access denied</Title>
              <Text size="sm" c="dimmed">
                You must be an administrator to manage news posts.
              </Text>
            </div>
          </Group>
        </Paper>
      </Container>
    );
  }

  const selected = useMemo(() => posts.find((p) => p.id === editingId) ?? null, [posts, editingId]);

  function resetToNew() {
    setEditingId(null);
    form.setValues({ title: '', pinned: false, isPublished: false });
    setContentJSON(EMPTY_DOC);
    setPlainText('');
    editor?.commands.setContent(EMPTY_DOC);
    form.resetDirty();
    form.resetTouched();
  }

  function startEditing(p: NewsPost) {
    setEditingId(p.id);
    form.setValues({
      title: p.title,
      pinned: p.pinned,
      isPublished: p.isPublished,
    });
    setContentJSON(p.contentJSON ?? EMPTY_DOC);
    // editor content will be set via effect
    form.resetDirty();
    form.resetTouched();
  }

  async function save() {
    const v = form.validate();
    if (v.hasErrors) return;

    if (!editor) {
      alert('Editor not ready yet.');
      return;
    }

    const raw = editor.getJSON();
    const safeContentJSON = JSON.parse(JSON.stringify(raw));

    try {
      const res: any = await upsertNewsPostCallable({
        postId: editingId ?? null,
        title: form.values.title,
        pinned: form.values.pinned,
        isPublished: form.values.isPublished,
        contentJSON: safeContentJSON,
        plainText: editor.getText(),
      });

      const newId = res?.data?.postId as string | undefined;
      if (newId) setEditingId(newId);

      form.resetDirty();
    } catch (err) {
      console.error(err);
      alert('Failed to save news post. Check console for details.');
    }
  }

  async function togglePinned(p: NewsPost) {
    try {
      await updateNewsPostFlagsCallable({ postId: p.id, pinned: !p.pinned });
    } catch (err) {
      console.error(err);
      alert('Failed to update pinned state.');
    }
  }

  async function togglePublish(p: NewsPost) {
    try {
      await updateNewsPostFlagsCallable({ postId: p.id, isPublished: !p.isPublished });
    } catch (err) {
      console.error(err);
      alert('Failed to update publish state.');
    }
  }

  async function deletePost(p: NewsPost) {
    const ok = window.confirm(`Delete this news post?\n\n${p.title}\n\nThis cannot be undone.`);
    if (!ok) return;

    try {
      await deleteNewsPostCallable({ postId: p.id });
      if (editingId === p.id) resetToNew();
    } catch (err) {
      console.error(err);
      alert('Failed to delete news post.');
    }
  }

  return (
    <Container size="lg" py="xl">
      <Stack gap="md">
        <Group justify="space-between" align="flex-end">
          <div>
            <Title order={2}>News Manager</Title>
            <Text size="sm" c="dimmed">
              Posts shown on the homepage (full content, expandable if needed).
            </Text>
          </div>

          <Group gap="xs">
            <Button component={RouterLink} to="/admin/reports" variant="default" size="xs">
              Moderation reports
            </Button>
            <Button onClick={resetToNew} variant="light" size="xs">
              New post
            </Button>
          </Group>
        </Group>

        <Group align="flex-start" gap="md" wrap="wrap">
          {/* Editor */}
          <Paper withBorder radius="lg" p="md" style={{ flex: 1, minWidth: 320 }}>
            <Stack gap="sm">
              <Group justify="space-between" align="center">
                <Title order={4}>{editingId ? 'Edit post' : 'Create post'}</Title>
                <Group gap="xs">
                  <Badge
                    variant="light"
                    color={form.values.isPublished ? 'green' : 'gray'}
                    style={{ textTransform: 'none', fontWeight: 500 }}
                  >
                    {form.values.isPublished ? 'Published' : 'Draft'}
                  </Badge>
                  {form.values.pinned && (
                    <Badge
                      variant="light"
                      color="yellow"
                      style={{ textTransform: 'none', fontWeight: 500 }}
                    >
                      Pinned
                    </Badge>
                  )}
                </Group>
              </Group>

              <TextInput
                label="Title"
                placeholder="What changed?"
                {...form.getInputProps('title')}
              />

              <Group gap="xs">
                <Button
                  size="xs"
                  variant={form.values.isPublished ? 'filled' : 'outline'}
                  onClick={() => form.setFieldValue('isPublished', !form.values.isPublished)}
                >
                  {form.values.isPublished ? 'Published' : 'Draft'}
                </Button>

                <Button
                  size="xs"
                  variant={form.values.pinned ? 'filled' : 'outline'}
                  onClick={() => form.setFieldValue('pinned', !form.values.pinned)}
                >
                  {form.values.pinned ? 'Pinned' : 'Not pinned'}
                </Button>

                <Button size="xs" onClick={save}>
                  Save
                </Button>
              </Group>

              <Divider />

              <Stack gap={6}>
                <Text size="sm" fw={500}>
                  Content
                </Text>

                <RichTextEditor editor={editor}>
                  <RichTextEditor.Toolbar sticky stickyOffset={60}>
                    <RichTextEditor.ControlsGroup>
                      <RichTextEditor.Bold />
                      <RichTextEditor.Italic />
                      <RichTextEditor.Underline />
                      <RichTextEditor.Strikethrough />
                    </RichTextEditor.ControlsGroup>

                    <RichTextEditor.ControlsGroup>
                      <RichTextEditor.H1 />
                      <RichTextEditor.H2 />
                      <RichTextEditor.H3 />
                    </RichTextEditor.ControlsGroup>

                    <RichTextEditor.ControlsGroup>
                      <RichTextEditor.BulletList />
                      <RichTextEditor.OrderedList />
                      <RichTextEditor.Blockquote />
                      <RichTextEditor.Hr />
                    </RichTextEditor.ControlsGroup>

                    <RichTextEditor.ControlsGroup>
                      <RichTextEditor.Link />
                      <RichTextEditor.Unlink />
                    </RichTextEditor.ControlsGroup>

                    <RichTextEditor.ControlsGroup>
                      <RichTextEditor.AlignLeft />
                      <RichTextEditor.AlignCenter />
                      <RichTextEditor.AlignRight />
                    </RichTextEditor.ControlsGroup>
                  </RichTextEditor.Toolbar>

                  <RichTextEditor.Content />
                </RichTextEditor>

                <Text size="xs" c="dimmed">
                  Preview: {plainText.trim().replace(/\s+/g, ' ').slice(0, 200) || '—'}
                </Text>

                {selected?.updatedAt && (
                  <Text size="xs" c="dimmed">
                    Last updated: {selected.updatedAt.toLocaleString()}
                  </Text>
                )}
              </Stack>
            </Stack>
          </Paper>

          {/* List */}
          <Paper withBorder radius="lg" p="md" style={{ width: 380, maxWidth: '100%' }}>
            <Stack gap="sm">
              <Group justify="space-between" align="center">
                <Title order={4}>Posts</Title>
                <Badge variant="light" style={{ textTransform: 'none' }}>
                  {posts.length}
                </Badge>
              </Group>

              {error && (
                <Paper radius="md" p="sm" withBorder>
                  <Text size="sm" c="red">
                    {error}
                  </Text>
                </Paper>
              )}

              {loadingList ? (
                <Group justify="center" py="md">
                  <Loader />
                </Group>
              ) : posts.length === 0 ? (
                <Text size="sm" c="dimmed">
                  No posts yet.
                </Text>
              ) : (
                <Stack gap="xs">
                  {posts.map((p) => (
                    <Paper
                      key={p.id}
                      withBorder
                      radius="md"
                      p="sm"
                      style={{
                        cursor: 'pointer',
                        borderColor:
                          editingId === p.id ? 'var(--mantine-color-blue-5)' : undefined,
                      }}
                      onClick={() => startEditing(p)}
                    >
                      <Stack gap={6}>
                        <Group justify="space-between" align="flex-start" gap="xs">
                          <Box style={{ minWidth: 0 }}>
                            <Text fw={600} size="sm" style={{ wordBreak: 'break-word' }}>
                              {p.title}
                            </Text>
                            <Text size="xs" c="dimmed">
                              {p.isPublished && p.publishedAt
                                ? `Published ${p.publishedAt.toLocaleDateString()}`
                                : p.createdAt
                                ? `Created ${p.createdAt.toLocaleDateString()}`
                                : '—'}
                            </Text>
                          </Box>

                          <Group gap={6}>
                            <Badge
                              size="sm"
                              variant="light"
                              color={p.isPublished ? 'green' : 'gray'}
                              style={{ textTransform: 'none', fontWeight: 500 }}
                            >
                              {p.isPublished ? 'Published' : 'Draft'}
                            </Badge>
                            {p.pinned && (
                              <Badge
                                size="sm"
                                variant="light"
                                color="yellow"
                                style={{ textTransform: 'none', fontWeight: 500 }}
                              >
                                Pinned
                              </Badge>
                            )}
                          </Group>
                        </Group>

                        <Text size="xs" c="dimmed" lineClamp={2}>
                          {p.previewText || '—'}
                        </Text>

                        <Divider />

                        <Group justify="space-between" align="center" wrap="nowrap">
                          <Group gap={6}>
                            <Tooltip label={p.pinned ? 'Unpin' : 'Pin'} withArrow>
                              <Button
                                size="xs"
                                variant="subtle"
                                px={6}
                                leftSection={p.pinned ? <PinOff size={14} /> : <Pin size={14} />}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  togglePinned(p);
                                }}
                              >
                                {p.pinned ? 'Unpin' : 'Pin'}
                              </Button>
                            </Tooltip>

                            <Button
                              size="xs"
                              variant="light"
                              onClick={(e) => {
                                e.stopPropagation();
                                togglePublish(p);
                              }}
                            >
                              {p.isPublished ? 'Unpublish' : 'Publish'}
                            </Button>
                          </Group>

                          <Button
                            size="xs"
                            variant="subtle"
                            color="red"
                            leftSection={<Trash2 size={14} />}
                            onClick={(e) => {
                              e.stopPropagation();
                              deletePost(p);
                            }}
                          >
                            Delete
                          </Button>
                        </Group>
                      </Stack>
                    </Paper>
                  ))}
                </Stack>
              )}
            </Stack>
          </Paper>
        </Group>
      </Stack>
    </Container>
  );
}
