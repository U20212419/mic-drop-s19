package com.twokb.micdrop.dto;

import java.util.List;

import com.twokb.micdrop.model.DiscordUser;

public record RoundAssignmentsResponse(List<DiscordUser> contestants, List<DiscordUser> judges) {
}
