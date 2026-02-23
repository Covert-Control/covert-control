// src/components/TagPicker.tsx
import { useMemo, useState } from 'react';
import { Chip, Group, Paper, Stack, TagsInput, Text } from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { useQuery } from '@tanstack/react-query';
import {
  collection,
  endAt,
  getDocs,
  limit as fbLimit,
  orderBy,
  query as fsQuery,
  startAt,
} from 'firebase/firestore';
import { db } from '../config/firebase';

type TagDoc = {
  id: string;    // doc id
  name: string;  // lowercase display name (with spaces)
  count: number; // number of stories using the tag
};

export type FeaturedTagGroup = {
  label: string;
  tags: string[];
};

export type TagPickerProps = {
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  maxTags?: number;
  minCharsToSearch?: number;    // default 3
  suggestionLimit?: number;     // default 10
  minTagLength?: number;        // default 2 (changed to allow fd/md/ff/mf/mm)
  disabled?: boolean;

  // New:
  featuredTitle?: string;
  featuredDescription?: string;
  featuredGroups?: FeaturedTagGroup[];
  hideFeaturedFromInput?: boolean; // default true
};

/** Lowercase + trim; collapse multiple spaces to one */
function normalize(s: string) {
  return s
    .trim()
    .toLowerCase()
    .replace(/\s*\(\d+\)\s*$/, '') // remove trailing " (123)"
    .replace(/\s+/g, ' ');
}

/** Remove all chars except a-z, 0-9, space, hyphen; collapse spaces; trim */
function cleanAllowedChars(s: string) {
  return s.replace(/[^a-z0-9 -]/g, '').replace(/\s+/g, ' ').trim();
}

/** Case-insensitive dedupe that preserves first occurrence */
function dedupeCaseInsensitive(values: string[]) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    const key = normalize(v);
    if (!seen.has(key)) {
      seen.add(key);
      out.push(key);
    }
  }
  return out;
}

export function TagPicker({
  value,
  onChange,
  placeholder = 'Separate tags with commas',
  maxTags,
  minCharsToSearch = 3,
  suggestionLimit = 10,
  minTagLength = 2, // IMPORTANT: allow 2-char tags like fd/md
  disabled,

  featuredTitle = 'Recommended tags',
  featuredDescription,
  featuredGroups,
  hideFeaturedFromInput = true,
}: TagPickerProps) {
  const [search, setSearch] = useState('');
  const [debounced] = useDebouncedValue(search, 200);

  // Build featured canonical order + set
  const featuredOrder = useMemo(() => {
    const flat =
      featuredGroups?.flatMap((g) => g.tags.map((t) => cleanAllowedChars(normalize(t)))) ?? [];
    // preserve first occurrence order, drop empties
    return dedupeCaseInsensitive(flat.filter(Boolean));
  }, [featuredGroups]);

  const featuredSet = useMemo(() => new Set(featuredOrder), [featuredOrder]);

  const normalizedSearch = normalize(debounced);
  const enabled = normalizedSearch.length >= minCharsToSearch;

  const { data } = useQuery<TagDoc[]>({
    queryKey: ['tags-suggest', normalizedSearch, suggestionLimit],
    enabled,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    queryFn: async () => {
      const s = normalizedSearch;
      if (!s) return [];

      const tagsCol = collection(db, 'tags');
      const qy = fsQuery(
        tagsCol,
        orderBy('name'),
        startAt(s),
        endAt(s + '\uf8ff'),
        fbLimit(suggestionLimit)
      );

      const snap = await getDocs(qy);
      const list: TagDoc[] = snap.docs.map((d) => {
        const doc = d.data() as any;
        const name = typeof doc.name === 'string' ? doc.name : d.id;
        return {
          id: d.id,
          name: normalize(name),
          count: typeof doc.count === 'number' ? doc.count : 0,
        };
      });

      list.sort((a, b) => a.name.localeCompare(b.name));
      return list;
    },
  });

  const suggestions = useMemo(
    () => (data ?? []).map((t) => ({ value: t.name, label: `${t.name} (${t.count})` })),
    [data]
  );

  /**
   * Sanitize a tag array while:
   * - allowing featured tags even if minTagLength would reject them
   * - deduping
   * - optionally placing featured tags first
   * - respecting maxTags while prioritizing featured tags
   */
  const sanitizeWithFeatured = (arr: string[]) => {
    const cleaned = (arr ?? []).map((t) => cleanAllowedChars(normalize(t))).filter(Boolean);

    // allow featured tags even if < minTagLength
    const lengthFiltered = cleaned.filter((t) => featuredSet.has(t) || t.length >= minTagLength);

    const deduped = dedupeCaseInsensitive(lengthFiltered);

    // featured first (in canonical order), then the rest in their original deduped order
    const featuredFirst = featuredOrder.filter((t) => deduped.includes(t));
    const nonFeatured = deduped.filter((t) => !featuredSet.has(t));
    const combined = [...featuredFirst, ...nonFeatured];

    if (typeof maxTags === 'number') {
      // ensure featured are kept as priority
      const keptFeatured = featuredFirst.slice(0, maxTags);
      const remainingSlots = Math.max(0, maxTags - keptFeatured.length);
      return [...keptFeatured, ...nonFeatured.slice(0, remainingSlots)];
    }

    return combined;
  };

  // Full value (including featured) — this is the canonical truth
  const fullValue = useMemo(() => sanitizeWithFeatured(value ?? []), [value, featuredOrder, minTagLength, maxTags]);

  // Selected featured tags (canonical)
  const selectedFeatured = useMemo(
    () => fullValue.filter((t) => featuredSet.has(t)),
    [fullValue, featuredSet]
  );

  // Tags shown/edited in the TagsInput
  const inputValue = useMemo(() => {
    if (!hideFeaturedFromInput) return fullValue;
    return fullValue.filter((t) => !featuredSet.has(t));
  }, [fullValue, hideFeaturedFromInput, featuredSet]);

  const handleInputChange = (next: string[]) => {
    // next = what the user edited in the input (may exclude featured if hidden)
    const merged = hideFeaturedFromInput ? [...(next ?? []), ...selectedFeatured] : (next ?? []);
    onChange(sanitizeWithFeatured(merged));
  };

  const toggleFeatured = (tagRaw: string) => {
    const tag = cleanAllowedChars(normalize(tagRaw));
    if (!tag) return;

    const has = selectedFeatured.includes(tag);
    const next = has ? fullValue.filter((t) => t !== tag) : [...fullValue, tag];
    onChange(sanitizeWithFeatured(next));
  };

  const hasFeaturedGroups = (featuredGroups?.length ?? 0) > 0;

  // group status (selected vs missing)
  // const groupStatus = useMemo(() => {
  //   const groups = featuredGroups ?? [];
  //   return groups.map((g) => {
  //     const tags = g.tags.map((t) => cleanAllowedChars(normalize(t))).filter(Boolean);
  //     const hasAny = tags.some((t) => selectedFeatured.includes(t));
  //     return { label: g.label, hasAny };
  //   });
  // }, [featuredGroups, selectedFeatured]);

  return (
    <Stack gap="sm">
      {hasFeaturedGroups && (
        <Paper withBorder radius="md" p="sm">
          <Stack gap="xs">
            <Group justify="space-between" wrap="wrap" gap="xs">
              <div>
                <Text size="sm" fw={600}>
                  {featuredTitle}
                </Text>
                {featuredDescription && (
                  <Text size="xs" c="dimmed">
                    {featuredDescription}
                  </Text>
                )}
              </div>


            </Group>

            {featuredGroups?.map((g) => (
              <Group key={g.label} gap="sm" wrap="wrap" align="center">
                <Text size="xs" fw={600} c="dimmed" style={{ minWidth: 70 }}>
                  {g.label}
                </Text>

                <Group gap="xs" wrap="wrap">
                  {g.tags.map((t) => {
                    const canon = cleanAllowedChars(normalize(t));
                    const checked = canon ? selectedFeatured.includes(canon) : false;
                    return (
                      <Chip
                        key={`${g.label}-${t}`}
                        checked={checked}
                        onChange={() => toggleFeatured(t)}
                        variant="light"
                        size="sm"
                        disabled={disabled}
                      >
                        {t}
                      </Chip>
                    );
                  })}
                </Group>
              </Group>
            ))}
          </Stack>
        </Paper>
      )}

      <Text>Other Tags:</Text>

      <TagsInput
        data={suggestions}
        value={inputValue}
        onChange={handleInputChange}
        placeholder={placeholder}
        searchValue={search}
        onSearchChange={setSearch}
        maxDropdownHeight={240}
        disabled={disabled}
        clearable
        // splitChars={[',']}
      />
    </Stack>
  );
}