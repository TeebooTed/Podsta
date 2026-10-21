import { Route, Routes } from 'react-router-dom';
import ComposerPreview from './ComposerPreview.jsx';
import PromptPreview from './PromptPreview.jsx';

/** Local-only pages used by Playwright. Not linked from the app, and not built for the public site. */
export default function PreviewApp() {
  return (
    <Routes>
      <Route path="/preview/composer" element={<ComposerPreview />} />
      <Route path="/preview/prompt" element={<PromptPreview />} />
    </Routes>
  );
}
