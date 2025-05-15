// import { RichTextEditor, Link } from '@mantine/tiptap';
// import { useEditor } from '@tiptap/react';
// // import Highlight from '@tiptap/extension-highlight';
// import StarterKit from '@tiptap/starter-kit';
// import Underline from '@tiptap/extension-underline';
// // import TextAlign from '@tiptap/extension-text-align';
// // import Superscript from '@tiptap/extension-superscript';
// // import SubScript from '@tiptap/extension-subscript';
// import CharacterCount from '@tiptap/extension-character-count'
// import { useEffect, useState } from 'react';

// const content =
//   '<h2 style="text-align: center;">TIPTAP2</h2>';

//   const limit = 100;



// export function TipTap2() {
//   const [wordCount, setWordCount] = useState(0);
//   const [charCount, setCharCount] = useState(0);

//     const editor = useEditor({
//     extensions: [
//         CharacterCount.configure({
//         wordCounter: (text) =>
//             text.split(/\s+/).filter((word) => word !== '').length,
//         }),
//         StarterKit,
//         Underline,
//         Link,
//     ],
//     content,
//     onCreate: ({ editor }) => {
//         // Delay count calculation by a microtask
//         setTimeout(() => {
//         setWordCount(editor.storage.characterCount.words());
//         setCharCount(editor.storage.characterCount.characters());
//         }, 0);
//     },
//     onUpdate: ({ editor }) => {
//         setWordCount(editor.storage.characterCount.words());
//         setCharCount(editor.storage.characterCount.characters());
//     },
//     });

//   if (!editor) {
//     return null
//   };

//     const logCharacters = () => {
//         console.log(editor.storage)
//         console.log('WORDS:', editor.storage.characterCount.words());
//         console.log('CHARS:', editor.storage.characterCount.characters());
//     }

//     return (
//     <>
        // <RichTextEditor editor={editor}>
        //     <RichTextEditor.Toolbar sticky stickyOffset={60}>
        //         <RichTextEditor.ControlsGroup>
        //             <RichTextEditor.Bold />
        //             <RichTextEditor.Italic />
        //             <RichTextEditor.Underline />
        //             {/* <RichTextEditor.Strikethrough />
        //             <RichTextEditor.ClearFormatting />
        //             <RichTextEditor.Highlight /> */}
        //             <RichTextEditor.Code />
        //         </RichTextEditor.ControlsGroup>

        //         <RichTextEditor.ControlsGroup>
        //             <RichTextEditor.H1 />
        //             <RichTextEditor.H2 />
        //             <RichTextEditor.H3 />
        //             <RichTextEditor.H4 />
        //         </RichTextEditor.ControlsGroup>

        //         <RichTextEditor.ControlsGroup>
        //             <RichTextEditor.Blockquote />
        //             <RichTextEditor.Hr />
        //             <RichTextEditor.BulletList />
        //             <RichTextEditor.OrderedList />
        //             <RichTextEditor.Subscript />
        //             <RichTextEditor.Superscript />
        //         </RichTextEditor.ControlsGroup>

        //         <RichTextEditor.ControlsGroup>
        //             <RichTextEditor.Link />
        //             <RichTextEditor.Unlink />
        //         </RichTextEditor.ControlsGroup>

        //         <RichTextEditor.ControlsGroup>
        //             <RichTextEditor.AlignLeft />
        //             <RichTextEditor.AlignCenter />
        //             <RichTextEditor.AlignJustify />
        //             <RichTextEditor.AlignRight />
        //         </RichTextEditor.ControlsGroup>

        //         <RichTextEditor.ControlsGroup>
        //             <RichTextEditor.Undo />
        //             <RichTextEditor.Redo />
        //         </RichTextEditor.ControlsGroup>
        //     </RichTextEditor.Toolbar>

        //     <RichTextEditor.Content />
        // </RichTextEditor>

//         <br></br>
//         <div
//         className={`character-count ${
//             charCount === limit ? 'character-count--warning' : ''
//         }`}
//         >

//         {charCount} / {limit} characters
//         <br />
//         {wordCount} or maybe {editor.storage.characterCount.words()} words
//         </div>
//         <button onClick={logCharacters}>Console Log!</button>
//     </>
//   );

// }
import './tiptap.css'
import { RichTextEditor, Link } from '@mantine/tiptap';
import { useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import { useState } from 'react';

const content = 'TIPTAP2';
const limit = 10;

export function TipTap2() {
  const [wordCount, setWordCount] = useState(0);
  const [charCount, setCharCount] = useState(0);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Link,
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

  const logCharacters = () => {
    if (!editor) return;
    
    const text = editor.getText();
    console.log('Current text:', text);
    console.log('WORDS:', text.trim() === '' ? 0 : text.trim().split(/\s+/).length);
    console.log('CHARS:', text.length);
  };

  if (!editor) return null;

  return (
    <>
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

      <br />
      <div className={`character-count ${charCount >= limit ? 'character-count--warning' : ''}`}>
        {wordCount} words
      </div>
      <button onClick={logCharacters}>Console Log!</button>
    </>
  );
}