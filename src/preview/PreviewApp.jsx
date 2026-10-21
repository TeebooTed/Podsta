import { Route, Routes } from 'react-router-dom';
import CalmPreview from './CalmPreview.jsx';

/** Local-only pages used by Playwright. Not built for the public site. */
export default function PreviewApp() {
  return (
    <Routes>
      <Route path="/preview/calm" element={<CalmPreview />} />
    </Routes>
  );
}
