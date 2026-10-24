export type SignupRole = 'athlete' | 'coach' | 'self_coach';

// Presentation only. Registration and AuthContext retain admission/access authority.
export const SIGNUP_PATHS = {
  athlete: {
    label: 'Athlete', icon: 'barbell-outline',
    headline: 'Your coach.\nYour next level.',
    description: 'A clear plan, every session. Your coach in your corner.',
    features: ['Follow your program', 'Share lift videos', 'See your progress'],
    requirement: 'You’ll need an invitation from your coach for the email you use.',
    nextStep: 'Coach invitation · No athlete subscription',
    captures: [
      { name: 'athlete-session-live-seeded.png', label: 'Your training, ready to go', focus: 0.14 },
      { name: 'athlete-ledger-seeded.png', label: 'Progress you can see', focus: 0.30 },
    ],
  },
  coach: {
    label: 'Coach', icon: 'people-outline',
    headline: 'More coaching.\nLess chasing.',
    description: 'Bring your athletes, programming and feedback into one place.',
    features: ['Build training plans', 'Review lift videos', 'Know who needs you'],
    requirement: 'Founder beta access code required. Verify your email, then set up your trial.',
    nextStep: 'Beta access code · Email verification · Trial setup',
    captures: [
      { name: 'coach-brief.png', label: 'The full coaching picture', focus: 0.125 },
      { name: 'coach-programming.png', label: 'A plan for every athlete', focus: 0.12 },
    ],
  },
  self_coach: {
    label: 'Self-Coach', icon: 'flash-outline',
    headline: 'Your training.\nYour terms.',
    description: 'Build your plan. Put in the work. Watch your story unfold.',
    features: ['Create your program', 'Log every lift', 'Track personal bests'],
    requirement: 'Your own Individual workspace. Verify your email, then set up your trial.',
    nextStep: 'Your account · Email verification · Trial setup',
    captures: [
      { name: 'self-session.png', label: 'Built for the work', focus: 0.14 },
      { name: 'self-ledger.png', label: 'Every lift leaves a mark', focus: 0.30 },
    ],
  },
} as const;
