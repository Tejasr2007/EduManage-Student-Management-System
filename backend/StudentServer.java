
import com.sun.net.httpserver.HttpServer;
import com.sun.net.httpserver.HttpExchange;

import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.sql.*;
import java.util.*;

public class StudentServer {

    public static void main(String[] args) throws IOException {

        HttpServer server = HttpServer.create(
            new InetSocketAddress(8081), 0
        );

        server.createContext("/students", StudentServer::handleStudents);

        server.start();

        System.out.println("CampusSphere Java Server started!");
        System.out.println("API: http://localhost:8081/students");
    }

    private static void handleStudents(HttpExchange exchange)
            throws IOException {

        exchange.getResponseHeaders().set(
            "Access-Control-Allow-Origin", "*"
        );
        exchange.getResponseHeaders().set(
            "Access-Control-Allow-Methods",
            "GET, POST, PUT, DELETE, OPTIONS"
        );
        exchange.getResponseHeaders().set(
            "Access-Control-Allow-Headers", "Content-Type"
        );

        String method = exchange.getRequestMethod();
        String path = exchange.getRequestURI().getPath();

        try {

            if (method.equals("OPTIONS")) {
                sendResponse(exchange, 204, "");
                return;
            }

            if (method.equals("GET") && path.equals("/students")) {
                getStudents(exchange);
            }
            else if (method.equals("POST") && path.equals("/students")) {
                addStudent(exchange);
            }
            else if (method.equals("PUT") && path.matches("/students/\\d+")) {
                updateStudent(exchange, path);
            }
            else if (method.equals("DELETE") && path.matches("/students/\\d+")) {
                deleteStudent(exchange, path);
            }
            else {
                sendResponse(exchange, 404,
                    "{\"message\":\"Endpoint not found\"}");
            }

        } catch (Exception e) {

            e.printStackTrace();

            sendResponse(exchange, 500,
                "{\"message\":\"Server error. Check Java console.\"}");

        } finally {
            exchange.close();
        }
    }

    // Read all students from MySQL
    private static void getStudents(HttpExchange exchange)
            throws SQLException, IOException {

        String sql = "SELECT * FROM students ORDER BY id";

        List<String> records = new ArrayList<>();

        try (Connection con = DBConnection.getConnection();
             Statement stmt = con.createStatement();
             ResultSet rs = stmt.executeQuery(sql)) {

            while (rs.next()) {

                String student = "{"
                    + "\"id\":" + rs.getInt("id") + ","
                    + "\"name\":\"" + json(rs.getString("name")) + "\","
                    + "\"email\":\"" + json(rs.getString("email")) + "\","
                    + "\"phone\":\"" + json(rs.getString("phone")) + "\","
                    + "\"department\":\"" + json(rs.getString("department")) + "\","
                    + "\"year\":" + rs.getInt("year")
                    + "}";

                records.add(student);
            }
        }

        sendResponse(exchange, 200,
            "[" + String.join(",", records) + "]");
    }

    // Insert a student into MySQL
    private static void addStudent(HttpExchange exchange)
            throws Exception {

        Map<String, String> data = readForm(exchange);

        String name = data.getOrDefault("name", "").trim();
        String email = data.getOrDefault("email", "").trim();
        String phone = data.getOrDefault("phone", "").trim();
        String department = data.getOrDefault("department", "").trim();
        int year = Integer.parseInt(data.getOrDefault("year", "0"));

        if (name.isEmpty() || email.isEmpty()
                || department.isEmpty() || year < 1 || year > 4) {

            sendResponse(exchange, 400,
                "{\"message\":\"Please enter valid student details\"}");
            return;
        }

        String sql = "INSERT INTO students "
            + "(name, email, phone, department, year) "
            + "VALUES (?, ?, ?, ?, ?)";

        try (Connection con = DBConnection.getConnection();
             PreparedStatement ps = con.prepareStatement(
                 sql, Statement.RETURN_GENERATED_KEYS)) {

            ps.setString(1, name);
            ps.setString(2, email);
            ps.setString(3, phone);
            ps.setString(4, department);
            ps.setInt(5, year);

            ps.executeUpdate();

            try (ResultSet keys = ps.getGeneratedKeys()) {
                if (keys.next()) {
                    sendResponse(exchange, 201,
                        "{\"message\":\"Student saved successfully\","
                        + "\"id\":" + keys.getInt(1) + "}");
                    return;
                }
            }
        }

        sendResponse(exchange, 500,
            "{\"message\":\"Student could not be saved\"}");
    }

    // Update student name and phone
    private static void updateStudent(
            HttpExchange exchange, String path)
            throws Exception {

        int id = Integer.parseInt(path.substring(
            path.lastIndexOf("/") + 1
        ));

        Map<String, String> data = readForm(exchange);

        String name = data.getOrDefault("name", "").trim();
        String phone = data.getOrDefault("phone", "").trim();

        if (name.isEmpty()) {
            sendResponse(exchange, 400,
                "{\"message\":\"Name cannot be empty\"}");
            return;
        }

        String sql = "UPDATE students SET name=?, phone=? WHERE id=?";

        try (Connection con = DBConnection.getConnection();
             PreparedStatement ps = con.prepareStatement(sql)) {

            ps.setString(1, name);
            ps.setString(2, phone);
            ps.setInt(3, id);

            int rows = ps.executeUpdate();

            sendResponse(exchange, rows > 0 ? 200 : 404,
                rows > 0
                ? "{\"message\":\"Student updated successfully\"}"
                : "{\"message\":\"Student not found\"}");
        }
    }

    // Delete student
    private static void deleteStudent(
            HttpExchange exchange, String path)
            throws Exception {

        int id = Integer.parseInt(path.substring(
            path.lastIndexOf("/") + 1
        ));

        String sql = "DELETE FROM students WHERE id=?";

        try (Connection con = DBConnection.getConnection();
             PreparedStatement ps = con.prepareStatement(sql)) {

            ps.setInt(1, id);

            int rows = ps.executeUpdate();

            sendResponse(exchange, rows > 0 ? 200 : 404,
                rows > 0
                ? "{\"message\":\"Student deleted successfully\"}"
                : "{\"message\":\"Student not found\"}");
        }
    }

    // Read form data sent by JavaScript
    private static Map<String, String> readForm(
            HttpExchange exchange) throws IOException {

        String body = new String(
            exchange.getRequestBody().readAllBytes(),
            StandardCharsets.UTF_8
        );

        Map<String, String> data = new HashMap<>();

        for (String pair : body.split("&")) {

            String[] parts = pair.split("=", 2);

            String key = URLDecoder.decode(
                parts[0], StandardCharsets.UTF_8
            );

            String value = parts.length > 1
                ? URLDecoder.decode(parts[1], StandardCharsets.UTF_8)
                : "";

            data.put(key, value);
        }

        return data;
    }

    // Safely format text as JSON
    private static String json(String value) {

        if (value == null) return "";

        return value.replace("\\", "\\\\")
                    .replace("\"", "\\\"")
                    .replace("\n", "\\n")
                    .replace("\r", "\\r");
    }

    // Send HTTP response
    private static void sendResponse(
            HttpExchange exchange, int status, String response)
            throws IOException {

        byte[] bytes = response.getBytes(StandardCharsets.UTF_8);

        exchange.getResponseHeaders().set(
            "Content-Type", "application/json; charset=UTF-8"
        );

        if (status == 204) {
            exchange.sendResponseHeaders(status, -1);
        } else {
            exchange.sendResponseHeaders(status, bytes.length);
            exchange.getResponseBody().write(bytes);
        }
    }
}
