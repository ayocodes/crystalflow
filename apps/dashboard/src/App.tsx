import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Projects from './pages/Projects';
import ProjectDetail from './pages/ProjectDetail';
import VideoDetail from './pages/VideoDetail';
import Agents from './pages/Agents';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Projects />} />
        <Route path="projects/:id" element={<ProjectDetail />} />
        <Route path="projects/:id/videos/:videoId" element={<VideoDetail />} />
        <Route path="agents" element={<Agents />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
