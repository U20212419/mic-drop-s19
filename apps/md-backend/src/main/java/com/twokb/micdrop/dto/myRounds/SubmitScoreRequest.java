package com.twokb.micdrop.dto.myRounds;

import java.math.BigDecimal;

public record SubmitScoreRequest(Integer idSubmission, BigDecimal score, String review) {
}
