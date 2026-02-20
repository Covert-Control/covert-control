import { setGlobalOptions } from 'firebase-functions/v2';

setGlobalOptions({
  region: 'us-central1',
  serviceAccount: 'covert-control@appspot.gserviceaccount.com',
  // memory/timeout/etc can go here too
});

/* ------------------------------------------------------------------ */
/*  Auth / Registration                                                */
/* ------------------------------------------------------------------ */
export { registerUser } from './registerUser';
export { completeGoogleRegistration } from './completeGoogleRegistration';

/* ------------------------------------------------------------------ */
/*  Stories                                                            */
/* ------------------------------------------------------------------ */
export { incrementStoryView } from './incrementStoryView';

/* ------------------------------------------------------------------ */
/*  Tags                                                               */
/* ------------------------------------------------------------------ */
export {
  updateTagsOnStoryCreate,
  updateTagsOnStoryUpdate,
  updateTagsOnStoryDelete,
} from './tagCounters';

/* ------------------------------------------------------------------ */
/*  Account deletion                                                  */
/* ------------------------------------------------------------------ */
export { deleteMyAccount } from './deleteAccount.v1';

/* ------------------------------------------------------------------ */
/*  Like/Unlike Stories                                                 */
/* ------------------------------------------------------------------ */
export { likeCreated } from './likeStory';

export { likeDeleted } from './likeStory';

/* ------------------------------------------------------------------ */
/*  Like/Unlike Stories                                                 */
/* ------------------------------------------------------------------ */
export { syncUserRolesToCustomClaims } from './updateAdmin';

/* ------------------------------------------------------------------ */
/*  Ban/Delete Users                                                 */
/* ------------------------------------------------------------------ */
export { adminBanUser } from './adminBanUser.v1';

export { adminDeleteUser } from './adminDeleteUser.v1';

export { adminDeleteAndBanUser } from './adminDeleteAndBanUser.v1';

/* ------------------------------------------------------------------ */
/*  Delete Stories/Chapters                                               */
/* ------------------------------------------------------------------ */
export { deleteChapter } from './deleteChapter';

export { deleteStory } from './deleteStory';

/* ------------------------------------------------------------------ */
/*  Submit or Edit Story/Chapter                                             */
/* ------------------------------------------------------------------ */
export { createStoryWithFirstChapter } from './createStoryWithFirstChapter';

export { saveChapter } from './saveChapter';

/* ------------------------------------------------------------------ */
/*  Submit or edit public profile                                           */
/* ------------------------------------------------------------------ */
export { updatePublicProfile } from './updatePublicProfile';

/* ------------------------------------------------------------------ */
/*  News posts                                          */
/* ------------------------------------------------------------------ */
export { upsertNewsPost } from './upsertNewsPost';
export { updateNewsPostFlags } from './updateNewsPostFlags';
export { deleteNewsPost } from './deleteNewsPost';