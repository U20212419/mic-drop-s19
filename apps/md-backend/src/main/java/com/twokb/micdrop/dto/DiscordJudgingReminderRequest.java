package com.twokb.micdrop.dto;

import java.time.Instant;

import jakarta.validation.constraints.Future;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record DiscordJudgingReminderRequest(@NotBlank(message = "Channel ID cannot be empty") String channelId,
		@NotNull(message = "Judging deadline is required") @Future(
				message = "Judging deadline must be in the future") Instant deadline) {
}
