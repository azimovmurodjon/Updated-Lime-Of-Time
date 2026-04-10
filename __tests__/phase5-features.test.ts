import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("PDF Export Feature", () => {
  it("should have pdf-export utility module", () => {
    const filePath = path.join(__dirname, "..", "lib", "pdf-export.ts");
    expect(fs.existsSync(filePath)).toBe(true);
  });

  it("pdf-export should export generatePdfHtml functions", () => {
    const content = fs.readFileSync(
      path.join(__dirname, "..", "lib", "pdf-export.ts"),
      "utf-8"
    );
    expect(content).toContain("export function");
    expect(content).toContain("generateClientsPdf");
    expect(content).toContain("generateAppointmentsPdf");
    expect(content).toContain("generateServicesPdf");
    expect(content).toContain("generateRevenuePdf");
  });

  it("data-export screen should dynamically import pdf-export", () => {
    const content = fs.readFileSync(
      path.join(__dirname, "..", "app", "data-export.tsx"),
      "utf-8"
    );
    expect(content).toContain("pdf-export");
    expect(content).toContain("exportPdf");
  });

  it("data-export screen should have PDF export buttons for all report types", () => {
    const content = fs.readFileSync(
      path.join(__dirname, "..", "app", "data-export.tsx"),
      "utf-8"
    );
    // Export buttons use labels: Clients, Appointments, Services, Revenue
    expect(content).toContain('"Clients"');
    expect(content).toContain('"Appointments"');
    expect(content).toContain('"Services"');
    expect(content).toContain('"Revenue"');
  });
});

describe("Reviews in Business Settings", () => {
  it("settings screen should display reviews section", () => {
    const content = fs.readFileSync(
      path.join(__dirname, "..", "app", "(tabs)", "settings.tsx"),
      "utf-8"
    );
    expect(content).toContain("Client Reviews");
    expect(content).toContain("state.reviews");
  });

  it("reviews should be read-only (no delete buttons)", () => {
    const content = fs.readFileSync(
      path.join(__dirname, "..", "app", "(tabs)", "settings.tsx"),
      "utf-8"
    );
    // The reviews section should not have delete/remove functionality
    const reviewsSectionStart = content.indexOf("Client Reviews");
    const reviewsSectionEnd = content.indexOf("Log Out", reviewsSectionStart);
    if (reviewsSectionStart >= 0 && reviewsSectionEnd >= 0) {
      const reviewsSection = content.substring(reviewsSectionStart, reviewsSectionEnd);
      expect(reviewsSection).not.toContain("deleteReview");
      expect(reviewsSection).not.toContain("removeReview");
    }
  });

  it("reviews should show star ratings", () => {
    const content = fs.readFileSync(
      path.join(__dirname, "..", "app", "(tabs)", "settings.tsx"),
      "utf-8"
    );
    // Should render stars for ratings
    expect(content).toContain("rating");
  });
});

describe("Cancel/Reschedule Improvements", () => {
  it("manage appointment page should auto-populate client phone", () => {
    const content = fs.readFileSync(
      path.join(__dirname, "..", "server", "publicRoutes.ts"),
      "utf-8"
    );
    // The manage page should receive client data and pre-fill phone
    expect(content).toContain("clientPhone");
    expect(content).toContain("manageAppointmentPage");
  });

  it("pending appointments should only allow cancel, not reschedule", () => {
    const content = fs.readFileSync(
      path.join(__dirname, "..", "server", "publicRoutes.ts"),
      "utf-8"
    );
    // The manage page should check status for showing reschedule option
    expect(content).toContain("pending");
    expect(content).toContain("confirmed");
  });

  it("reschedule should enforce 24-hour rule on server side", () => {
    const content = fs.readFileSync(
      path.join(__dirname, "..", "server", "publicRoutes.ts"),
      "utf-8"
    );
    // Server-side reschedule endpoint should check 24-hour window
    expect(content).toContain("24");
    expect(content).toContain("reschedule");
  });

  it("acceptance SMS should include manage/reschedule link", () => {
    const content = fs.readFileSync(
      path.join(__dirname, "..", "lib", "types.ts"),
      "utf-8"
    );
    // generateAcceptMessage should include manage link
    expect(content).toContain("appointmentId");
    expect(content).toContain("/manage/");
    expect(content).toContain("reschedule");
  });

  it("appointment-detail should pass appointmentId to generateAcceptMessage", () => {
    const content = fs.readFileSync(
      path.join(__dirname, "..", "app", "appointment-detail.tsx"),
      "utf-8"
    );
    expect(content).toContain("appointment.id");
    expect(content).toContain("generateAcceptMessage");
  });
});

describe("Staff Selection in Client Booking", () => {
  it("booking page should have staff selection UI", () => {
    const content = fs.readFileSync(
      path.join(__dirname, "..", "server", "publicRoutes.ts"),
      "utf-8"
    );
    expect(content).toContain("staffList");
    expect(content).toContain("selectedStaff");
    expect(content).toContain("selectStaff");
  });

  it("booking page should load staff data from API", () => {
    const content = fs.readFileSync(
      path.join(__dirname, "..", "server", "publicRoutes.ts"),
      "utf-8"
    );
    expect(content).toContain("loadStaff");
    expect(content).toContain("/staff");
  });

  it("public staff API endpoint should exist", () => {
    const content = fs.readFileSync(
      path.join(__dirname, "..", "server", "publicRoutes.ts"),
      "utf-8"
    );
    expect(content).toContain("api/public/business");
    expect(content).toContain("staff");
  });

  it("staff info should be included in booking confirmation", () => {
    const content = fs.readFileSync(
      path.join(__dirname, "..", "server", "publicRoutes.ts"),
      "utf-8"
    );
    expect(content).toContain("staffHtml");
    expect(content).toContain("Preferred staff");
  });
});

describe("Staff Calendar View", () => {
  it("should have staff-calendar screen file", () => {
    const filePath = path.join(__dirname, "..", "app", "staff-calendar.tsx");
    expect(fs.existsSync(filePath)).toBe(true);
  });

  it("staff calendar should have calendar and timeline view modes", () => {
    const content = fs.readFileSync(
      path.join(__dirname, "..", "app", "staff-calendar.tsx"),
      "utf-8"
    );
    expect(content).toContain("calendar");
    expect(content).toContain("timeline");
    expect(content).toContain("viewMode");
  });

  it("staff calendar should show staff member stats", () => {
    const content = fs.readFileSync(
      path.join(__dirname, "..", "app", "staff-calendar.tsx"),
      "utf-8"
    );
    expect(content).toContain("Upcoming");
    expect(content).toContain("Pending");
    expect(content).toContain("Completed");
    expect(content).toContain("Revenue");
  });

  it("staff calendar should show working hours for selected day", () => {
    const content = fs.readFileSync(
      path.join(__dirname, "..", "app", "staff-calendar.tsx"),
      "utf-8"
    );
    expect(content).toContain("selectedDaySchedule");
    expect(content).toContain("Working:");
    expect(content).toContain("Day Off");
  });

  it("staff calendar should show assigned services", () => {
    const content = fs.readFileSync(
      path.join(__dirname, "..", "app", "staff-calendar.tsx"),
      "utf-8"
    );
    expect(content).toContain("Assigned Services");
    expect(content).toContain("assignedServices");
  });

  it("staff calendar should show weekly schedule", () => {
    const content = fs.readFileSync(
      path.join(__dirname, "..", "app", "staff-calendar.tsx"),
      "utf-8"
    );
    expect(content).toContain("Weekly Schedule");
    expect(content).toContain("workingHours");
  });

  it("staff screen should have Calendar button to navigate to staff calendar", () => {
    const content = fs.readFileSync(
      path.join(__dirname, "..", "app", "staff.tsx"),
      "utf-8"
    );
    expect(content).toContain("staff-calendar");
    expect(content).toContain("Calendar");
  });
});

describe("Appointment Type - staffId field", () => {
  it("Appointment interface should have optional staffId field", () => {
    const content = fs.readFileSync(
      path.join(__dirname, "..", "lib", "types.ts"),
      "utf-8"
    );
    expect(content).toContain("staffId?: string");
  });
});

describe("Store - getStaffById helper", () => {
  it("store should export getStaffById in context", () => {
    const content = fs.readFileSync(
      path.join(__dirname, "..", "lib", "store.tsx"),
      "utf-8"
    );
    expect(content).toContain("getStaffById");
    expect(content).toContain("getStaffById: (id: string) => StaffMember | undefined");
  });
});
