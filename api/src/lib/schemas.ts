import { z } from 'zod';

export const image = z.looseObject({ url: z.string() });
export const spotifyItem = z.looseObject({
  id: z.string().optional(),
  images: z.array(image).nullable().optional(),
  owner: z.looseObject({ id: z.string().optional() }).optional(),
  public: z.boolean().nullable().optional(),
});
export const spotifyData = z.looseObject({
  error: z.unknown().optional(),
  id: z.string().optional(),
  context: z.looseObject({ type: z.string(), uri: z.string() }).nullable().optional(),
  items: z.array(spotifyItem).optional(),
  tracks: z.looseObject({ total: z.number().optional() }).optional(),
  external_urls: z.looseObject({ spotify: z.string().optional() }).optional(),
});
// Playlist details use a paging object for items, unlike library list responses.
export const spotifyPlaylistData = spotifyData
  .omit({ items: true })
  .extend({ items: z.looseObject({ total: z.number().optional() }).optional() })
  // The extended shape already satisfies spotifyData, so the mapped object is
  // built directly rather than paying for a second validation pass.
  .transform(({ items, ...data }): z.output<typeof spotifyData> => ({
    ...data,
    tracks: items ?? data.tracks,
  }));

export const tokenData = z.looseObject({
  error: z.unknown().optional(),
  access_token: z.string().optional(),
  refresh_token: z.string().optional(),
});
export const game = z.object({
  appid: z.number(),
  name: z.string().optional(),
  playtime_forever: z.number().default(0),
  playtime_2weeks: z.number().default(0),
});
export const steamData = z.object({
  response: z.object({
    players: z
      .array(
        z.object({
          personaname: z.string().optional(),
          profileurl: z.string().optional(),
          avatar: z.string().optional(),
          avatarmedium: z.string().optional(),
          avatarfull: z.string().optional(),
          personastate: z.number().default(0),
          gameid: z.string().optional(),
          gameextrainfo: z.string().optional(),
          timecreated: z.number().optional(),
        }),
      )
      .optional(),
    player_level: z.number().optional(),
    games: z.array(game).optional(),
  }),
});
export const lanyardData = z.object({
  success: z.boolean(),
  data: z
    .object({
      discord_user: z.object({
        id: z.string().regex(/^\d+$/),
        username: z.string(),
        global_name: z.string().nullable().optional(),
        avatar: z.string().nullable(),
      }),
      discord_status: z.string(),
      activities: z.array(z.looseObject({})),
    })
    .optional(),
});
