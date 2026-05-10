package com.twokb.micdrop.dto;

import java.util.List;

public record RoundAssignmentsResponse(List<RoundAssignmentDTO> contestants, List<RoundAssignmentDTO> judges) {
}
