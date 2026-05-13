package com.twokb.micdrop.dto.myRounds;

import java.util.List;

public record BatchScoreRequest(Integer idRound, List<SubmitScoreRequest> scores) {
}
