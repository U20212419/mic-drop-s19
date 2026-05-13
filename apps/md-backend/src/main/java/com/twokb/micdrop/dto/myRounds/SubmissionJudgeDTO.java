package com.twokb.micdrop.dto.myRounds;

import java.math.BigDecimal;

public record SubmissionJudgeDTO(Integer idSubmission, String subLink, BigDecimal score, String review) {
}
