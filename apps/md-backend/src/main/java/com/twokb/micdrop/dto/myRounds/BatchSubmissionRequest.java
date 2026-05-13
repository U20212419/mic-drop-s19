package com.twokb.micdrop.dto.myRounds;

import java.util.List;

public record BatchSubmissionRequest(Integer idRound, List<SubmitLinkRequest> submissions) {
}
