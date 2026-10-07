import React from 'react';
import { useContext } from 'react';
import { useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { PeekContext } from './TabSwipe';

const ease = [0.22, 1, 0.36, 1];

// A screen that arrives via a tab swipe was already on screen sliding in, and
// the live preview of the neighbouring tab must show up whole: neither should
// replay the fade-up entrance.
function useSkipEnter() {
  const peeking = useContext(PeekContext);
  const { state } = useLocation();
  return peeking || !!state?.swiped;
}

const containerVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.55, ease } },
};

// Wrap a screen's content in <Stagger> and each block in <Rise> — the blocks
// then fade up one after another on entry, the same unfolding feel as the
// My Table screen.
export function Stagger({ children, className, style }) {
  const skip = useSkipEnter();
  return (
    <motion.div variants={containerVariants} initial={skip ? false : 'hidden'} animate="show" className={className} style={style}>
      {children}
    </motion.div>
  );
}

export function Rise({ children, className, style, onClick }) {
  return (
    <motion.div variants={itemVariants} className={className} style={style} onClick={onClick}>
      {children}
    </motion.div>
  );
}

// Standalone fade-up (no parent <Stagger> needed), e.g. for a list row that
// appears later than the rest of the screen.
export function FadeUp({ children, className, style, delay = 0 }) {
  const skip = useSkipEnter();
  return (
    <motion.div
      initial={skip ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, ease, delay }}
      className={className}
      style={style}
    >
      {children}
    </motion.div>
  );
}
