package com.whatsapp.clone;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class WhatsappCloneApplication {

    public static void main(String[] args) {
        SpringApplication.run(WhatsappCloneApplication.class, args);
        System.out.println("WhatsApp Clone running -> http://localhost:8080");
    }
}
