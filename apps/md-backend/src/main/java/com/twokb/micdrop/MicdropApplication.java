package com.twokb.micdrop;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class MicdropApplication {

	public static void main(String[] args) {
		SpringApplication.run(MicdropApplication.class, args);
	}

}
