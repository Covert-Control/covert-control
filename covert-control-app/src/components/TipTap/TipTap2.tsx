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
import { addDoc, collection } from 'firebase/firestore';
import { auth } from '../../config/firebase'

const content = '';
const limit = 1000; // Character limit for the story

export function TipTap2() {
  const [wordCount, setWordCount] = useState(0);
  const [charCount, setCharCount] = useState(0);
  const storyCollectionRef = collection(db, 'stories')

  const form = useForm({
    initialValues: {
      title: '',
      description: '',
      content: '',
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
        if (wordCount > 30) {
          return 'Maximum of 500 words allowed. Please split longer stories into multiple chapters';
        }
        if (charCount > limit) {
          return `Character limit exceeded! You have ${charCount} characters, but the limit is ${limit}. Please split longer stories into multiple chapters`;
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
    try {
      await addDoc(storyCollectionRef, {title: form.values.title, description: form.values.description, content: editor?.getText(), uid: auth.currentUser.uid, createdAt: new Date()});
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