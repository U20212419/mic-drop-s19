package com.twokb.micdrop.event;

public class ContestantUnregisteredEvent {

	private final Integer userId;

	public ContestantUnregisteredEvent(Integer userId) {
		this.userId = userId;
	}

	public Integer getUserId() {
		return userId;
	}

}
