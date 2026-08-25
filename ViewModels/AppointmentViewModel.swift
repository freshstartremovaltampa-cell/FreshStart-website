import Foundation
import SwiftUI
import PhotosUI

// MARK: - Firebase imports (uncomment when Firebase SDK is added)
// import FirebaseFirestore
// import FirebaseStorage

@MainActor
class AppointmentViewModel: ObservableObject {
    @Published var appointments: [Appointment] = []
    @Published var isLoading = false
    @Published var errorMessage: String?
    @Published var uploadProgress: Double = 0

    // MARK: - Firebase stubs (replace bodies with real Firebase calls)

    func fetchAppointments() async {
        isLoading = true
        defer { isLoading = false }

        // Firestore: let snapshot = try await Firestore.firestore()
        //     .collection("appointments")
        //     .order(by: "scheduledDate")
        //     .getDocuments()
        // appointments = snapshot.documents.compactMap { try? $0.data(as: Appointment.self) }

        // Placeholder data for development
        appointments = sampleAppointments
    }

    func saveAppointment(_ appointment: Appointment) async throws {
        isLoading = true
        defer { isLoading = false }

        var updated = appointment
        updated.updatedAt = Date()

        // Firestore: try await Firestore.firestore()
        //     .collection("appointments")
        //     .document(appointment.id)
        //     .setData(from: updated)

        upsertLocal(updated)
    }

    func deleteAppointment(_ appointment: Appointment) async throws {
        // Firestore: try await Firestore.firestore()
        //     .collection("appointments")
        //     .document(appointment.id)
        //     .delete()

        appointments.removeAll { $0.id == appointment.id }
    }

    func updateStatus(_ appointment: Appointment, to status: AppointmentStatus) async throws {
        var updated = appointment
        updated.status = status
        try await saveAppointment(updated)
    }

    // MARK: - Photo Upload

    /// Uploads images selected via PhotosPicker and returns their download URLs.
    func uploadPhotos(_ items: [PhotosPickerItem], appointmentID: String) async throws -> [String] {
        var urls: [String] = []
        let total = Double(items.count)

        for (index, item) in items.enumerated() {
            guard let data = try await item.loadTransferable(type: Data.self) else { continue }

            let fileName = "\(appointmentID)/\(UUID().uuidString).jpg"
            // Firebase Storage:
            // let ref = Storage.storage().reference().child("appointments/\(fileName)")
            // let _ = try await ref.putDataAsync(data)
            // let url = try await ref.downloadURL()
            // urls.append(url.absoluteString)

            // Placeholder: simulate upload
            try await Task.sleep(nanoseconds: 300_000_000)
            urls.append("https://placeholder.example.com/\(fileName)")

            uploadProgress = Double(index + 1) / total
        }

        uploadProgress = 0
        return urls
    }

    // MARK: - Helpers

    var todayAppointments: [Appointment] {
        let today = Calendar.current.startOfDay(for: Date())
        let tomorrow = Calendar.current.date(byAdding: .day, value: 1, to: today)!
        return appointments.filter { $0.scheduledDate >= today && $0.scheduledDate < tomorrow }
    }

    var upcomingAppointments: [Appointment] {
        appointments
            .filter { $0.scheduledDate >= Date() && $0.status != .cancelled }
            .sorted { $0.scheduledDate < $1.scheduledDate }
    }

    private func upsertLocal(_ appointment: Appointment) {
        if let index = appointments.firstIndex(where: { $0.id == appointment.id }) {
            appointments[index] = appointment
        } else {
            appointments.append(appointment)
        }
    }
}

// MARK: - Sample data (remove when Firebase is live)

private let sampleAppointments: [Appointment] = [
    Appointment(
        id: "1",
        customerName: "Maria Lopez",
        customerPhone: "813-555-0101",
        customerEmail: "maria@example.com",
        serviceAddress: "4321 W Kennedy Blvd, Tampa, FL 33609",
        serviceType: .furnitureRemoval,
        scheduledDate: Calendar.current.date(byAdding: .hour, value: 2, to: Date())!,
        status: .confirmed
    ),
    Appointment(
        id: "2",
        customerName: "James Carter",
        customerPhone: "813-555-0202",
        customerEmail: "james@example.com",
        serviceAddress: "789 N Dale Mabry Hwy, Tampa, FL 33609",
        serviceType: .estateCleanout,
        scheduledDate: Calendar.current.date(byAdding: .day, value: 1, to: Date())!,
        status: .pending,
        estimatedCost: 450.00
    ),
    Appointment(
        id: "3",
        customerName: "Susan Wright",
        customerPhone: "813-555-0303",
        customerEmail: "susan@example.com",
        serviceAddress: "1122 E Hillsborough Ave, Tampa, FL 33604",
        serviceType: .applianceRemoval,
        scheduledDate: Calendar.current.date(byAdding: .day, value: 2, to: Date())!,
        status: .confirmed,
        estimatedCost: 175.00
    )
]
