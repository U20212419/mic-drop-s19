package com.twokb.micdrop.dto.myRounds;

import com.twokb.micdrop.dto.JudgeAppDTO;

public record JudgeDetailDTO(String discordId, String username, JudgeAppDTO judgeApp, String subLink) {
}
