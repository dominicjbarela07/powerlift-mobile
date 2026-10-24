export type SignupRole = 'athlete' | 'coach' | 'self_coach';

// Presentation only. Registration and AuthContext retain admission/access authority.
export const SIGNUP_PATHS = {
  athlete: {
    label: 'Athlete',
    description: 'Your program, lift videos and coach feedback in one place.',
    requirement: 'You’ll need an invitation from your coach for the email you use.',
  },
  coach: {
    label: 'Coach',
    description: 'Programming, athlete insights and video reviews in one workspace.',
    requirement: 'Founder beta access code required. Verify your email, then set up your trial.',
  },
  self_coach: {
    label: 'Self-Coach',
    description: 'Plan sessions, log your lifts and track personal bests.',
    requirement: 'Your own Individual workspace. Verify your email, then set up your trial.',
  },
} as const;
