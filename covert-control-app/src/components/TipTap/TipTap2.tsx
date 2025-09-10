import './tiptap.css'
import { RichTextEditor, Link } from '@mantine/tiptap';
import { useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Placeholder from '@tiptap/extension-placeholder';
import { useState } from 'react';
import { Button, TextInput, Textarea } from '@mantine/core';
import { useForm } from '@mantine/form';
import { db } from '../../config/firebase';
import { addDoc, increment, collection, serverTimestamp, setDoc, doc, getFirestore } from 'firebase/firestore';
import { auth } from '../../config/firebase'
import { useAuthStore } from '../../stores/authStore';
import { TagPicker } from '../../components/TagPicker';

const content = '';
const limit = 10000; // Character limit for the story
const TAGS_MAX = 8; // tweak as you like
const TAG_MIN_LEN = 2;
const TAG_MAX_LEN = 30;


export function TipTap2() {
  const [wordCount, setWordCount] = useState(0);
  const [charCount, setCharCount] = useState(0);
  const storyCollectionRef = collection(db, 'stories')
  const { username } = useAuthStore();

  const form = useForm({
    initialValues: {
      title: '',
      description: '',
      content: '',
      tags: [] as string[],
    },
    validate: {
      title: (value) => {
        if (!value.trim()) {
          return 'Title is required';
        }
        if (value.length > 30) {
          return 'Title must be less than 30 characters';
        }
        return null;
      },
      description: (value) => {
        if (!value.trim()) {
          return 'Description is required';
        }
        if (value.length > 100 || value.length < 10) {
          return 'Description must be between 10 and 100 characters';
        }
        return null;
      },
      content: (_) => {
        if (wordCount === 0) {
          return 'A story is required';
        }
        if (wordCount < 20) {
          return 'A chapter must have at least 20 words';
        }
        if (wordCount > 1000) {
          return 'Maximum of 1000 words allowed. Please split longer stories into multiple chapters';
        }
        if (charCount > limit) {
          return `Character limit exceeded! You have ${charCount} characters, but the limit is ${limit}. Please split longer stories into multiple chapters`;
        }
        return null;
      },
      tags: (tags) => {
        if (!Array.isArray(tags)) return 'Tags must be an array';
        if (tags.length > TAGS_MAX) return `Please use at most ${TAGS_MAX} tags`;
        for (const t of tags) {
          const s = t.trim();
          if (s.length < TAG_MIN_LEN) return `Tag "${t}" is too short`;
          if (s.length > TAG_MAX_LEN) return `Tag "${t}" is too long`;
        }
        return null;
      },
    },
  });

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Link,
      Placeholder.configure({ placeholder: 'Write your story here!' })
    ],
    content,
    onUpdate: ({ editor }) => {
      // Get plain text without HTML tags
      const text = editor.getText();
      
      // Calculate word count (handle empty editor case)
      const words = text.trim() === '' ? 0 : text.trim().split(/\s+/).length;
      
      // Calculate character count
      const chars = text.length;
      
      setWordCount(words);
      setCharCount(chars);
    },
  });

  // const logCharacters = () => {
  //   if (!editor) return;
    
  //   const text = editor.getText();
  //   console.log('Current text:', text);
  //   console.log('WORDS:', text.trim() === '' ? 0 : text.trim().split(/\s+/).length);
  //   console.log('CHARS:', text.length)
  //   console.log(wordCount);
  // };

  const logData = () => {
    console.log('Form data: ' + form.values.title + ' Description: ' + form.values.description + ' Content: ' + editor?.getText());
  }

  const onSubmitStory = async () => {
    if (!editor) return;

    if (!auth.currentUser) {
      console.error('User is not authenticated');
      return;
    }

    const db = getFirestore();
    const newStoryTitle = form.values.title;
    const now = serverTimestamp();
    const ownerId = auth.currentUser.uid;
    const tagsLower = (form.values.tags ?? [])
      .map(t => t.trim().toLowerCase().replace(/\s+/g, ' '))
      .filter(t => t.length >= 3);

    try {
      await addDoc(storyCollectionRef, {
        title: form.values.title,
        description: form.values.description,
        content: JSON.stringify(editor?.getJSON()),
        ownerId: auth.currentUser.uid,
        username: username,
        viewCount: 0,
        createdAt: serverTimestamp(),
        tags: tagsLower,
      });

      const authorDocRef = doc(db, 'authors_with_stories', ownerId);
      await setDoc(
        authorDocRef,
        {
          username: username,
          storyCount: increment(1),
          lastStoryTitle: newStoryTitle,
          lastStoryDate: now,
        },
        { merge: true }
      );
      console.log('Document successfully written!');
    } catch (error) {
      console.error("Error adding document: ", error);
    }
  }

  if (!editor) return null;

  return (
    <form onSubmit={form.onSubmit(onSubmitStory)}>

        <TextInput
          label="Title"
          {...form.getInputProps('title')}
          withAsterisk
          placeholder="Story title"
        />
        <Textarea
          label="Description"
          withAsterisk
          {...form.getInputProps('description')}
          placeholder="Provide a short description of your story"
        /> 
        <div style={{ marginTop: 16, marginBottom: 8 }}>
          <TagPicker
            value={form.values.tags}
            onChange={(tags) => form.setFieldValue('tags', tags)}
            maxTags={TAGS_MAX}
            placeholder="Add tags (e.g., science fiction, military)"
          />
          {form.errors.tags && (
            <div style={{ color: 'red', fontSize: '0.875rem' }}>{form.errors.tags}</div>
          )}
        </div>
        <br></br>
        <RichTextEditor editor={editor}>
            <RichTextEditor.Toolbar sticky stickyOffset={60}>
                <RichTextEditor.ControlsGroup>
                    <RichTextEditor.Bold />
                    <RichTextEditor.Italic />
                    <RichTextEditor.Underline />
                    <RichTextEditor.Code />
                </RichTextEditor.ControlsGroup>

                <RichTextEditor.ControlsGroup>
                    <RichTextEditor.H1 />
                    <RichTextEditor.H2 />
                    <RichTextEditor.H3 />
                    <RichTextEditor.H4 />
                </RichTextEditor.ControlsGroup>

                <RichTextEditor.ControlsGroup>
                    <RichTextEditor.Blockquote />
                    <RichTextEditor.Hr />
                    <RichTextEditor.BulletList />
                    <RichTextEditor.OrderedList />
                    <RichTextEditor.Subscript />
                    <RichTextEditor.Superscript />
                </RichTextEditor.ControlsGroup>

                <RichTextEditor.ControlsGroup>
                    <RichTextEditor.Link />
                    <RichTextEditor.Unlink />
                </RichTextEditor.ControlsGroup>

                <RichTextEditor.ControlsGroup>
                    <RichTextEditor.AlignLeft />
                    <RichTextEditor.AlignCenter />
                    <RichTextEditor.AlignJustify />
                    <RichTextEditor.AlignRight />
                </RichTextEditor.ControlsGroup>

                <RichTextEditor.ControlsGroup>
                    <RichTextEditor.Undo />
                    <RichTextEditor.Redo />
                </RichTextEditor.ControlsGroup>
            </RichTextEditor.Toolbar>

            <RichTextEditor.Content />
        </RichTextEditor>
      {form.errors.content && (
        <div style={{ color: 'red', fontSize: '0.875rem' }}>{form.errors.content}</div>
      )}    
      <div className={`character-count ${charCount >= limit ? 'character-count--warning' : ''}`}>
        {wordCount} words
      </div>
      <Button type="submit">Submit</Button><br />
      <button onClick={logData}>Console Log!</button>
    </form>
  );
}