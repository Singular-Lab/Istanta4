import Quill from 'quill';
import 'quill/dist/quill.snow.css';

const createRichTextEditor = (container) => {
  // Crea un contenitore per Quill
  const editorContainer = document.createElement('div');
  container.appendChild(editorContainer);

  // Configura Quill
  const quill = new Quill(editorContainer, {
    theme: 'snow', // Tema predefinito
    modules: {
      toolbar: [
        ['bold', 'italic', 'underline'], // Formattazioni base
        [{ 'header': [1, 2, false] }],   // Header
        [{ 'list': 'ordered' }, { 'list': 'bullet' }], // Liste
        [{ 'align': [] }],              // Allineamenti
        ['link', 'image'],              // Link e immagini
      ],
    },
  });

  return quill;
};