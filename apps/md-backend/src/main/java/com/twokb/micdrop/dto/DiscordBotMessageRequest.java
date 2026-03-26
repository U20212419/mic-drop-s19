package com.twokb.micdrop.dto;

import jakarta.validation.constraints.NotBlank;

public record DiscordBotMessageRequest(@NotBlank(message = "Channel ID cannot be empty") String channelId) {
}
