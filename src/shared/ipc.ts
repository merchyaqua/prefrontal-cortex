export const IPC = {
  claude: {
    rewrite: 'claude:rewrite',
    restructurePrinciple: 'claude:restructure-principle'
  },
  db: {
    listPrinciples: 'db:list-principles',
    upsertPrinciple: 'db:upsert-principle',
    deletePrinciple: 'db:delete-principle',
    listTells: 'db:list-tells',
    upsertTell: 'db:upsert-tell',
    deleteTell: 'db:delete-tell',
    insertCheckIn: 'db:insert-check-in',
    listCheckIns: 'db:list-check-ins',
    startSession: 'db:start-session',
    endSession: 'db:end-session',
    currentSession: 'db:current-session',
    insertThoughtLog: 'db:insert-thought-log',
    searchThoughtLogs: 'db:search-thought-logs',
    signInWithMagicLink: 'db:sign-in-magic-link',
    verifyOtp: 'db:verify-otp',
    setSession: 'db:set-session',
    signOut: 'db:sign-out',
    getSession: 'db:get-session',
    seedDefaultTells: 'db:seed-default-tells',
    listIntentions: 'db:list-intentions',
    upsertIntention: 'db:upsert-intention',
    deleteIntention: 'db:delete-intention'
  },
  focus: {
    current: 'focus:current'
  },
  hotkey: {
    openDestructor: 'hotkey:open-destructor',
    openCheckIn: 'hotkey:open-check-in'
  }
} as const
