import { GameHandler, GameHandlerContext, GameHandlerResult } from "../game-handler";
import { GameType, PlatformRegion } from "../../types";
import { SessionManager } from "../../session-manager";
import { RiotApiClient } from "../../riot-api";
import { getStreamMatches, calculateRecord } from "../../match-filter";
import { formatStreamRecord, formatOfflineRecord, formatNoGamesYet } from "./lol-formatter";

const RESPONSES = {
  NO_GAMES: "No ranked games this stream yet!",
  OFFLINE_NO_DATA: "Stream is offline. No previous record found.",
};

export class LoLHandler implements GameHandler {
  readonly gameType: GameType = "lol";

  async handleOnlineStream(ctx: GameHandlerContext): Promise<GameHandlerResult> {
    const { env, sessionManager, summoner, tag, region, streamStart, testStartLp } = ctx;
    const riotClient = new RiotApiClient(env);

    // Resolve session (new vs continuation)
    const { isNewSession, effectiveStreamStart, existingSession } =
      await sessionManager.resolveSession(this.gameType, summoner, tag, streamStart);

    // Get account data
    const account = await riotClient.getAccountByRiotId(summoner, tag, region);
    console.log("LoL Account PUUID:", account.puuid);

    // Get current rank data (LP, tier, rank, currentLp)
    const rankData = await riotClient.getCurrentSoloQueueLp(
      account.puuid,
      region
    );
    console.log("LoL Current rank data:", rankData);

    // Get matches since stream started
    const streamStartTimestamp = new Date(effectiveStreamStart).getTime();
    const matches = await getStreamMatches(
      riotClient,
      account.puuid,
      region,
      streamStartTimestamp
    );

    // Calculate record
    const { wins, losses } = calculateRecord(matches);
    const gamesPlayed = wins + losses;

    // Determine starting LP
    let startingLp: number | null;
    if (testStartLp !== null) {
      console.log("Using test starting LP:", testStartLp);
      startingLp = testStartLp;
    } else if (isNewSession) {
      // For new session, first check if we have auto-captured LP from cron
      const autoCapturedLp = await sessionManager.getCapturedStartingLp(
        summoner,
        tag,
        streamStart
      );
      if (autoCapturedLp !== null) {
        startingLp = autoCapturedLp;
      } else if (gamesPlayed === 0) {
        // No games played yet - current LP IS the starting LP
        console.log("No games played yet, capturing current LP as starting LP:", rankData.lp);
        startingLp = rankData.lp;
      } else {
        // Games already played before first !record
        console.log("Games already played before first !record, LP tracking may be inaccurate");
        startingLp = rankData.lp;
      }
    } else {
      // For continued session, use stored starting LP
      startingLp = existingSession?.startingLp ?? null;
    }

    // Calculate LP change
    let lpChange: number | null = null;
    if (startingLp !== null && rankData.lp !== null) {
      lpChange = rankData.lp - startingLp;
    }

    // Update session
    const updatedSession = isNewSession
      ? sessionManager.createNewSession(this.gameType, effectiveStreamStart, startingLp)
      : sessionManager.updateSession(existingSession!, wins, losses, lpChange);

    // Save with updated values
    updatedSession.wins = wins;
    updatedSession.losses = losses;
    if (lpChange !== null) {
      updatedSession.lpChange = lpChange;
    }

    await sessionManager.saveSession(this.gameType, summoner, tag, updatedSession);

    // Check if no games played
    if (wins === 0 && losses === 0) {
      const response = formatNoGamesYet(rankData.tier, rankData.rank, rankData.currentLp);
      return { response, session: updatedSession };
    }

    // Return formatted response with rank
    const response = formatStreamRecord(
      wins,
      losses,
      lpChange,
      rankData.tier,
      rankData.rank,
      rankData.currentLp
    );
    return { response, session: updatedSession };
  }

  async handleOfflineStream(
    sessionManager: SessionManager,
    summoner: string,
    tag: string
  ): Promise<GameHandlerResult> {
    const lastSession = await sessionManager.getSession(this.gameType, summoner, tag);

    if (!lastSession || (lastSession.wins === 0 && lastSession.losses === 0)) {
      return { response: RESPONSES.OFFLINE_NO_DATA };
    }

    const response = formatOfflineRecord(
      lastSession.wins,
      lastSession.losses,
      lastSession.lpChange
    );

    return { response, session: lastSession };
  }

  formatResponse(
    wins: number,
    losses: number,
    lpChange: number | null
  ): string {
    return formatStreamRecord(wins, losses, lpChange);
  }
}
