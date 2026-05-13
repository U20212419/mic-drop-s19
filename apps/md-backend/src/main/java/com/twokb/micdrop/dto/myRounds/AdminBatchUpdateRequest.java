package com.twokb.micdrop.dto.myRounds;

import java.util.List;

public record AdminBatchUpdateRequest (
    List<AdminSubmissionUpdateDTO> updates
) {
}
