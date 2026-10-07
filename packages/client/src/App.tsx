import { lazy, Suspense } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useStore } from './lib/store';
import { ease } from './ui/kit';
import Landing from './pages/Landing';
import Auth from './pages/Auth';

const Onboarding = lazy(() => import('./pages/Onboarding'));
const Assessment = lazy(() => import('./pages/Assessment'));
const Analyzing = lazy(() => import('./pages/Analyzing'));
const Studio = lazy(() => import('./pages/Studio'));

function Boot() {
  return (
    <div className="full center">
      <motion.div className="display h2 spectrum-text" animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.6, repeat: Infinity }}>M63</motion.div>
    </div>
  );
}

export default function App() {
  const { ready, route } = useStore();
  const pages = { landing: Landing, auth: Auth, onboarding: Onboarding, assessment: Assessment, analyzing: Analyzing, studio: Studio };
  const Page = pages[route];
  return (
    <>
      <div className="aurora" />
      <div className="grain" />
      <div className="app-layer">
        {!ready ? <Boot /> : (
          <Suspense fallback={<Boot />}>
            <AnimatePresence mode="wait">
              <motion.div key={route}
                initial={{ opacity: 0, filter: 'blur(14px)', scale: 0.985 }}
                animate={{ opacity: 1, filter: 'blur(0px)', scale: 1 }}
                exit={{ opacity: 0, filter: 'blur(14px)', scale: 1.01 }}
                transition={{ duration: 0.6, ease }}>
                <Page />
              </motion.div>
            </AnimatePresence>
          </Suspense>
        )}
      </div>
    </>
  );
}
