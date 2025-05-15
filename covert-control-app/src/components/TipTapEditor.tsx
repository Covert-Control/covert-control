import { RichTextEditor, Link } from '@mantine/tiptap';
import { useEditor } from '@tiptap/react';
// import Highlight from '@tiptap/extension-highlight';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
// import TextAlign from '@tiptap/extension-text-align';
// import Superscript from '@tiptap/extension-superscript';
// import SubScript from '@tiptap/extension-subscript';
import CharacterCount from '@tiptap/extension-character-count'
import { useEffect, useState } from 'react';

const content =
  '<h2 style="text-align: center;">Hi</h2>';

  const limit = 100;



export function TipTapEditor() {

  const [wordCount, setWordCount] = useState(0);
  const [charCount, setCharCount] = useState(0);

  const editor = useEditor({
    extensions: [
      CharacterCount.configure({
        wordCounter: (text) =>
          text.split(/\s+/).filter((word) => word !== '').length,
      }),
      StarterKit,
      Underline,
      Link,
    ],
    content,
    onUpdate: ({ editor }) => {
      // ✅ This will run every time the editor content changes
      setWordCount(editor.storage.characterCount.words());
      setCharCount(editor.storage.characterCount.characters());
    },
  });

  if (!editor) {
    return null
  };

  const percentage = editor
  ? Math.round((100 / limit) * editor.storage.characterCount.characters())
  : 0;

  return (
    <>
      <RichTextEditor editor={editor}>
        <RichTextEditor.Toolbar sticky stickyOffset={60}>
          <RichTextEditor.ControlsGroup>
            <RichTextEditor.Bold />
            <RichTextEditor.Italic />
            <RichTextEditor.Underline />
            {/* <RichTextEditor.Strikethrough />
            <RichTextEditor.ClearFormatting />
            <RichTextEditor.Highlight /> */}
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
      <br></br>
      <div className={`character-count ${editor.storage.characterCount.characters() === limit ? 'character-count--warning' : ''}`}>
          {charCount} / {limit} characters
          <br />
          {wordCount} words
        </div>
    </>
  );

}