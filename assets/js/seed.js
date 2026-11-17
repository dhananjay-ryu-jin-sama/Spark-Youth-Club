// Default content. Shown until the admin panel has published content to Firebase
// (and used as the first-time import when the admin logs in).
// Dates/times/venues are taken from the posters; descriptions are placeholders.

const P = (cat, n) => `assets/posters/${cat}/${n}.webp`;
const S = (cat, n) => `assets/posters/${cat}/${n}-sm.webp`;
const VENUE = 'Ashraya Library, ISKCON Coimbatore';

export const SEED = {
  categories: {
    tgis: {
      id: 'tgis', order: 1, name: 'TGIS', tagline: "Thank God It's Saturday",
      description: 'Our weekly Saturday evening. One big question, an honest discussion, live kirtan and a hot dinner with friends. No judgment, no pressure. Come as you are.',
      tags: ['Discussion', 'Music', 'Dinner'], cover: 'assets/img/cat-tgis.webp', accent: '#FFB300',
    },
    enthu: {
      id: 'enthu', order: 2, name: 'Enthu', tagline: 'Step out of the ordinary',
      description: 'Our flagship youth festival. A full evening of mime, music and a talk that stays with you, built for anyone who wants more from life than scrolling.',
      tags: ['Discussion', 'Mime', 'Music'], cover: 'assets/img/cat-enthu.webp', accent: '#FF5100',
    },
    siksha: {
      id: 'siksha', order: 3, name: 'Siksha', tagline: 'Wisdom for real life',
      description: 'Early-morning classes that go deeper. Practical lessons from the Bhagavad-gita on relationships, habits and purpose, taught by senior devotees.',
      tags: ['Class', 'Scripture', 'Q&A'], cover: 'assets/img/cat-siksha.webp', accent: '#FFA040',
    },
    dys: {
      id: 'dys', order: 4, name: 'DYS', tagline: 'Discover Your Self',
      description: 'A guided journey for newcomers. Overthinking, distraction, stress: we name the battles inside and learn the tools to win them, one Saturday at a time.',
      tags: ['Course', 'Friendship', 'Purpose'], cover: 'assets/img/cat-dys.webp', accent: '#FFC56B',
    },
  },

  sessions: {
    'vedas-the-timeless-truth': {
      categoryId: 'tgis', title: 'Vedas: The Timeless Truth', date: '2025-11-29', time: '19:00', venue: 'Ashraya Block Library, ISKCON Coimbatore',
      description: 'Thousands of years old and still ahead of us. What are the Vedas, who are they for, and why do they keep answering questions science is only now asking? Music, a talk and dinner.',
      poster: P('TGIS', 13), posterSm: S('TGIS', 13),
    },
    'glories-of-age-kali': {
      categoryId: 'tgis', title: 'Glories of Age Kali', date: '2026-05-16', time: '18:30', venue: VENUE,
      description: 'Four ages, and we landed in the hardest one. Greed, anger, loneliness: Kali-yuga has it all. Yet it hides one great gift. An evening on why this age may be the best time to be alive.',
      poster: P('TGIS', 11), posterSm: S('TGIS', 11),
    },
    'the-hidden-influence-of-sound': {
      categoryId: 'tgis', title: 'The Hidden Influence of Sound', date: '2026-05-27', time: '19:00', venue: VENUE,
      description: 'A song can change your mood in three seconds. So what is the sound you live in doing to you? We explore how sound shapes the mind, and what mantra does differently.',
      poster: P('TGIS', 12), posterSm: S('TGIS', 12),
    },
    'why-do-we-need-temples-part-2': {
      categoryId: 'tgis', title: 'Why Do We Need Temples? Part 2', date: '2026-06-04', time: '19:00', venue: VENUE,
      description: 'Some places are built with stone. Some are built to connect souls. Temples do both. Part two of our conversation on why sacred spaces still matter in a busy city.',
      poster: P('TGIS', 9), posterSm: S('TGIS', 9), altPosters: [P('TGIS', 8)],
    },
    'q-and-a-session': {
      categoryId: 'tgis', title: 'Q&A Session', date: '2026-07-11', time: '19:00', venue: VENUE,
      description: 'Ask. Explore. Grow. Bring the question you have been carrying around, however big or awkward. An open floor, straight answers, good company.',
      poster: P('TGIS', 10), posterSm: S('TGIS', 10),
    },
    'is-this-world-real-or-a-reflection': {
      categoryId: 'tgis', title: 'Is This World Real or a Reflection?', date: '2026-08-08', time: '19:00', venue: VENUE, speaker: 'Nithin',
      description: 'It feels solid, but so does a dream while you are in it. A look at what the Gita says about reality, illusion, and where the original is to be found.',
      poster: P('TGIS', 1), posterSm: S('TGIS', 1),
    },
    'the-helpless-passenger': {
      categoryId: 'tgis', title: 'The Helpless Passenger', date: '2026-08-21', time: '19:00', venue: VENUE,
      description: 'Lost in life\'s journey? Discover who is really in control. You are not alone on this ship, and there is a Captain.',
      poster: P('TGIS', 5), posterSm: S('TGIS', 5),
    },
    'tgis-open-circle': {
      categoryId: 'tgis', title: 'TGIS Open Circle', date: '2026-08-29', time: '19:00', venue: VENUE,
      description: 'No stage, no slides. We sit in a circle with chai and books and talk about what is actually on our minds. Good thoughts, good words, good life.',
      poster: P('TGIS', 6), posterSm: S('TGIS', 6),
    },
    'the-4th-dimension': {
      categoryId: 'tgis', title: 'The 4th Dimension', date: '2026-09-26', time: '19:00', venue: VENUE,
      description: 'Same reality, bigger questions. Time, space, and what lies beyond what we can see. An evening to expand your perspective.',
      poster: P('TGIS', 7), posterSm: S('TGIS', 7),
    },
    'learning-to-let-go': {
      categoryId: 'tgis', title: 'Learning to Let Go', date: '2026-10-24', time: '19:00', venue: VENUE,
      description: 'How much of our suffering comes from attachment? A talk on expectations, control and acceptance, and the freedom on the other side.',
      poster: P('TGIS', 14), posterSm: S('TGIS', 14),
    },
    'tgis-under-the-lights': {
      categoryId: 'tgis', title: 'TGIS Under the Lights', date: '2026-10-31', time: '19:00', venue: VENUE,
      description: 'Questions, ideas, friends, spirituality and good food under the open sky. Our outdoor edition of the Saturday you already love.',
      poster: P('TGIS', 15), posterSm: S('TGIS', 15),
    },
    'password-for-happiness': {
      categoryId: 'tgis', title: 'Password for Happiness', date: '2026-11-07', time: '19:00', venue: VENUE,
      description: 'Goals, focus, productivity: all ticked. Happiness: still loading. We debug the one account everyone is locked out of and look for the right password.',
      poster: P('TGIS', 16), posterSm: S('TGIS', 16),
    },
    'enthu-2025': {
      categoryId: 'enthu', title: 'Enthu 2025', date: '2025-08-23', time: '18:30', venue: 'Ashraya, ISKCON Coimbatore',
      description: 'Enthusiasm propels you beyond limits. A special youth festival with a discussion on life in a world of feeds, live music and dinner.',
      poster: P('ENTHU', 'image'), posterSm: S('ENTHU', 'image'),
    },
    'enthu-2026': {
      categoryId: 'enthu', title: 'Enthu 2026', date: '2026-09-12', time: '18:30', venue: 'ISKCON Coimbatore',
      description: 'Step out of the ordinary. Step into something extraordinary. Our biggest evening of the year: a mime that says what words cannot, a discussion, and music that lifts the roof.',
      poster: P('ENTHU', 2), posterSm: S('ENTHU', 2), altPosters: [P('ENTHU', 3)],
    },
    'dealing-with-friends-relatives-and-devotees': {
      categoryId: 'siksha', title: 'Dealing with Friends, Relatives and Devotees', date: '2026-11-15', time: '06:15', venue: 'ISKCON Coimbatore', speaker: 'Goplakrishna Karuna Das',
      description: 'Three circles, three kinds of relationships, one you. A morning class on keeping your spiritual life steady while loving the people around you well.',
      poster: P('SIKSHA', 18), posterSm: S('SIKSHA', 18),
    },
    'the-battle-inside': {
      categoryId: 'dys', title: 'The Battle Inside', date: '2026-11-21', time: '18:30', venue: 'ISKCON Coimbatore',
      description: 'Every day you choose. Who wins? Overthinking, distractions, addictions, confusion and stress on one side. Purpose, friendship, peace, wisdom and happiness on the other. Free entry.',
      poster: P('DYS', 4), posterSm: S('DYS', 4),
    },
  },

  // photos[sessionId][photoId]
  photos: {
    'password-for-happiness': {
      p1: { src: 'assets/img/g1.webp', thumb: 'assets/img/g1.webp', createdAt: 1 },
      p2: { src: 'assets/img/g2.webp', thumb: 'assets/img/g2.webp', createdAt: 2 },
      p3: { src: 'assets/img/g3.webp', thumb: 'assets/img/g3.webp', createdAt: 3 },
    },
    'enthu-2026': {
      p1: { src: 'assets/img/g4.webp', thumb: 'assets/img/g4.webp', createdAt: 1 },
      p2: { src: 'assets/img/g5.webp', thumb: 'assets/img/g5.webp', createdAt: 2 },
      p3: { src: 'assets/img/kirtan.webp', thumb: 'assets/img/kirtan.webp', createdAt: 3 },
    },
    'learning-to-let-go': {
      p1: { src: 'assets/img/g6.webp', thumb: 'assets/img/g6.webp', createdAt: 1 },
      p2: { src: 'assets/img/dinner.webp', thumb: 'assets/img/dinner.webp', createdAt: 2 },
    },
    'dealing-with-friends-relatives-and-devotees': {
      p1: { src: 'assets/img/g7.webp', thumb: 'assets/img/g7.webp', createdAt: 1 },
      p2: { src: 'assets/img/g8.webp', thumb: 'assets/img/g8.webp', createdAt: 2 },
    },
  },
};
