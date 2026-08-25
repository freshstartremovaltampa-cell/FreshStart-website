import SwiftUI
import PhotosUI

struct AppointmentBookingView: View {
    @ObservedObject var viewModel: AppointmentViewModel
    @Environment(\.dismiss) private var dismiss

    // Populate fields when editing an existing appointment
    let existingAppointment: Appointment?

    @State private var customerName = ""
    @State private var customerPhone = ""
    @State private var customerEmail = ""
    @State private var serviceAddress = ""
    @State private var serviceType = ServiceType.fullJunkRemoval
    @State private var scheduledDate = Date()
    @State private var estimatedCost = ""
    @State private var notes = ""
    @State private var status = AppointmentStatus.pending

    @State private var selectedPhotoItems: [PhotosPickerItem] = []
    @State private var displayImages: [UIImage] = []

    @State private var isSaving = false
    @State private var showError = false
    @State private var errorText = ""

    init(viewModel: AppointmentViewModel, appointment: Appointment? = nil) {
        self.viewModel = viewModel
        self.existingAppointment = appointment
    }

    var isEditing: Bool { existingAppointment != nil }

    var body: some View {
        NavigationStack {
            Form {
                customerSection
                serviceSection
                scheduleSection
                photosSection
                notesSection
                if isEditing { statusSection }
            }
            .navigationTitle(isEditing ? "Edit Appointment" : "New Appointment")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(isEditing ? "Save" : "Book") {
                        Task { await save() }
                    }
                    .disabled(isSaving || !isFormValid)
                }
            }
            .alert("Error", isPresented: $showError) {
                Button("OK", role: .cancel) {}
            } message: {
                Text(errorText)
            }
            .onAppear(perform: populateIfEditing)
        }
    }

    // MARK: - Form Sections

    private var customerSection: some View {
        Section("Customer Info") {
            TextField("Full Name", text: $customerName)
                .textContentType(.name)
            TextField("Phone Number", text: $customerPhone)
                .textContentType(.telephoneNumber)
                .keyboardType(.phonePad)
            TextField("Email", text: $customerEmail)
                .textContentType(.emailAddress)
                .keyboardType(.emailAddress)
                .autocapitalization(.none)
        }
    }

    private var serviceSection: some View {
        Section("Service Details") {
            TextField("Service Address", text: $serviceAddress)
                .textContentType(.fullStreetAddress)

            Picker("Service Type", selection: $serviceType) {
                ForEach(ServiceType.allCases, id: \.self) { type in
                    Text(type.rawValue).tag(type)
                }
            }

            HStack {
                Text("Estimated Cost")
                Spacer()
                TextField("$0.00", text: $estimatedCost)
                    .keyboardType(.decimalPad)
                    .multilineTextAlignment(.trailing)
                    .frame(width: 100)
            }
        }
    }

    private var scheduleSection: some View {
        Section("Schedule") {
            DatePicker(
                "Date & Time",
                selection: $scheduledDate,
                in: Date()...,
                displayedComponents: [.date, .hourAndMinute]
            )
        }
    }

    private var photosSection: some View {
        Section("Job Photos") {
            PhotoGridView(
                selectedItems: $selectedPhotoItems,
                displayImages: $displayImages,
                uploadProgress: viewModel.uploadProgress
            )
        }
    }

    private var notesSection: some View {
        Section("Notes") {
            TextField("Any special instructions…", text: $notes, axis: .vertical)
                .lineLimit(3...6)
        }
    }

    private var statusSection: some View {
        Section("Status") {
            Picker("Job Status", selection: $status) {
                ForEach(AppointmentStatus.allCases, id: \.self) { s in
                    Text(s.rawValue).tag(s)
                }
            }
            .pickerStyle(.segmented)
        }
    }

    // MARK: - Validation

    private var isFormValid: Bool {
        !customerName.trimmingCharacters(in: .whitespaces).isEmpty &&
        !customerPhone.trimmingCharacters(in: .whitespaces).isEmpty &&
        !serviceAddress.trimmingCharacters(in: .whitespaces).isEmpty
    }

    // MARK: - Actions

    private func populateIfEditing() {
        guard let appt = existingAppointment else { return }
        customerName    = appt.customerName
        customerPhone   = appt.customerPhone
        customerEmail   = appt.customerEmail
        serviceAddress  = appt.serviceAddress
        serviceType     = appt.serviceType
        scheduledDate   = appt.scheduledDate
        notes           = appt.notes
        status          = appt.status
        estimatedCost   = appt.estimatedCost.map { String(format: "%.2f", $0) } ?? ""
    }

    private func save() async {
        isSaving = true
        defer { isSaving = false }

        do {
            var uploadedURLs: [String] = existingAppointment?.photoURLs ?? []
            let appointmentID = existingAppointment?.id ?? UUID().uuidString

            if !selectedPhotoItems.isEmpty {
                let newURLs = try await viewModel.uploadPhotos(selectedPhotoItems, appointmentID: appointmentID)
                uploadedURLs.append(contentsOf: newURLs)
            }

            let appointment = Appointment(
                id: appointmentID,
                customerName: customerName.trimmingCharacters(in: .whitespaces),
                customerPhone: customerPhone.trimmingCharacters(in: .whitespaces),
                customerEmail: customerEmail.trimmingCharacters(in: .whitespaces),
                serviceAddress: serviceAddress.trimmingCharacters(in: .whitespaces),
                serviceType: serviceType,
                scheduledDate: scheduledDate,
                photoURLs: uploadedURLs,
                notes: notes,
                status: status,
                estimatedCost: Double(estimatedCost),
                createdAt: existingAppointment?.createdAt ?? Date(),
                updatedAt: Date()
            )

            try await viewModel.saveAppointment(appointment)
            dismiss()
        } catch {
            errorText = error.localizedDescription
            showError = true
        }
    }
}
