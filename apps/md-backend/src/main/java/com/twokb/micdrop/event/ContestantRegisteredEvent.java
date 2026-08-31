package com.twokb.micdrop.event;

public class ContestantRegisteredEvent {

	private final Integer userId;

	public ContestantRegisteredEvent(Integer userId) {
		this.userId = userId;
	}

	public Integer getUserId() {
		return userId;
	}

}
