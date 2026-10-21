import { Route, Routes } from 'react-router-dom';
import ComposerPreview from './ComposerPreview.jsx';

/** Local-only pages used by Playwright. Not linked from the app, and not built for the public site. */
export default function PreviewApp() {
  return (
    <Routes>
      <Route path="/preview/composer" element={<ComposerPreview />} />
    </Routes>
  );
}
