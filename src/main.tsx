import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import './index.css';
import { AdminGuruRoot } from './adminGuru/AdminGuruRoot';
import { StudentQuizView } from './adminGuru/StudentQuizView';

function detectStudentQuizCode(): string | null {
  const params = new URLSearchParams(window.location.search);
  const queryCode = params.get('kuis');
  if (queryCode && queryCode.trim()) {
    return queryCode.trim().toUpperCase();
  }
  const hashMatch = window.location.hash.match(/^#\/?kerjakan\/([A-Za-z0-9-]+)/i);
  if (hashMatch && hashMatch[1]) {
    return hashMatch[1].trim().toUpperCase();
  }
  return null;
}

const studentCode = detectStudentQuizCode();

if (studentCode) {
  const studentRootEl = document.getElementById('student-quiz-root');
  const welcomeEl = document.getElementById('welcome-screen-ma-tanada');
  const appEl = document.getElementById('app');
  if (welcomeEl) welcomeEl.style.display = 'none';
  if (appEl) appEl.style.display = 'none';
  if (studentRootEl) {
    studentRootEl.style.display = 'block';
    createRoot(studentRootEl).render(<StudentQuizView code={studentCode} />);
  }
} else {
  let activeReactRoot: Root | null = null;
  let activeContainer: HTMLElement | null = null;

  const unmountAdminGuru = () => {
    if (activeReactRoot) {
      activeReactRoot.unmount();
      activeReactRoot = null;
      activeContainer = null;
    }
  };

  const mountAdminGuru = (view: string, container: HTMLElement) => {
    if (!container) return;
    if (activeContainer !== container) {
      unmountAdminGuru();
      activeContainer = container;
      activeReactRoot = createRoot(container);
    }
    activeReactRoot?.render(<AdminGuruRoot view={view} />);
  };

  window.__mountAdminGuru = mountAdminGuru;
  window.__unmountAdminGuru = unmountAdminGuru;

  if (window.__pendingAdminGuruRoute) {
    const pending = window.__pendingAdminGuruRoute;
    window.__pendingAdminGuruRoute = null;
    if (pending.el && document.body.contains(pending.el)) {
      mountAdminGuru(pending.view, pending.el);
    }
  }
}
