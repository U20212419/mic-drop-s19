package com.twokb.micdrop.dto;

import java.time.Instant;
import java.util.List;

public record DiscordSubmissionReminderConfig(String channelId, Instant deadline, boolean enabled,
		List<Integer> reminderHours) {
}
