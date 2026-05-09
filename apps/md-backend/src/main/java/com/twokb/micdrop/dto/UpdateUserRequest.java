package com.twokb.micdrop.dto;

import com.twokb.micdrop.model.ContestantStatus;
import com.twokb.micdrop.model.GlobalRoleType;

public record UpdateUserRequest(String discordId, String username, ContestantStatus status, GlobalRoleType globalRole) {
}
