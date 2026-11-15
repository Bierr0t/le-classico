import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/anton';
import '@fontsource-variable/archivo';
import './styles.css';
import { App } from './App.tsx';

createRoot(document.getElementById('racine')!).render(<StrictMode><App /></StrictMode>);
