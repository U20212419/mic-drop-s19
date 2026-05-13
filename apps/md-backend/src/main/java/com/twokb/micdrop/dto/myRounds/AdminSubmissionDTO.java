package com.twokb.micdrop.dto.myRounds;

import java.math.BigDecimal;
import java.time.Instant;

public record AdminSubmissionDTO(
    Integer idSubmission, String subLink, BigDecimal score, String review,
    String title, String artist,
    String judgeDiscordId, String judgeUsername,
    String contestantDiscordId, String contestantUsername,
    Integer groupNumber, Instant submittedAt
) {
}
