package com.twokb.micdrop.dto;

public record DiscordJudgingReminderResponse(Integer roundNumber, int judgesMentioned, long songsRemaining,
		String channelId) {
}
