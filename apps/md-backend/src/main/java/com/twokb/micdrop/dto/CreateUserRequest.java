package com.twokb.micdrop.dto;

import com.twokb.micdrop.model.GlobalRoleType;

public record CreateUserRequest (String discordId, String username, GlobalRoleType globalRole) {
}
