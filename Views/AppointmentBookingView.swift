import SwiftUI
import PhotosUI

struct AppointmentBookingView: View {
    @ObservedObject var viewModel: AppointmentViewModel
    @Environment(\.dismiss) private var dismiss

    let existingAppointment: Appointment?

    @State private var customerName    = ""
    @State private var customerPhone   = ""
    @State private var serviceAddress  = ""
    @State private var scheduledDate   = Date()
    @State private var notes           = ""

    // PhotosPicker state — capped at 5 selections
    @State private var selectedPhotoItems: [PhotosPickerItem] = []
    @State private var selectedImages: [UIImage] = []

    @State private var isSaving  = false
    @State private var showError = false
    @State private var errorText = ""

    init(viewModel: AppointmentViewModel, appointment: Appointment? = nil) {
        self.viewModel = viewModel
        self.existingAppointment = appointment
    }

    var isEditing: Bool { existingAppointment != nil }

    // MARK: - Body

    var body: some View {
        NavigationStack {
            Form {
                contactSection
                addressSection
                dateTimeSection
                photoSection
                notesSection
            }
            .navigationTitle(isEditing ? "Edit Booking" : "Book a Pickup")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(isEditing ? "Save" : "Request Quote") {
                        Task { await save() }
                    }
                    .fontWeight(.semibold)
                    .disabled(isSaving || !isFormValid)
                }
            }
            .alert("Something went wrong", isPresented: $showError) {
                Button("OK", role: .cancel) {}
            } message: {
                Text(errorText)
            }
            .onAppear(perform: populateIfEditing)
        }
    }

    // MARK: - Sections

    /// Name and phone fields.
    private var contactSection: some View {
        Section("Your Info") {
            TextField("Full Name", text: $customerName)
                .textContentType(.name)

            TextField("Phone Number", text: $customerPhone)
                .textContentType(.telephoneNumber)
                .keyboardType(.phonePad)
        }
    }

    /// Single-line address field.
    private var addressSection: some View {
        Section("Pickup Address") {
            TextField("Street, City, State, ZIP", text: $serviceAddress)
                .textContentType(.fullStreetAddress)
        }
    }

    /// Date and time picker limited to future dates.
    private var dateTimeSection: some View {
        Section("Preferred Date & Time") {
            DatePicker(
                "Pickup Date",
                selection: $scheduledDate,
                in: Date()...,
                displayedComponents: [.date, .hourAndMinute]
            )
            .datePickerStyle(.graphical)
            .tint(.green)
        }
    }

    /// PhotosPicker button + horizontal scroll grid of thumbnails.
    private var photoSection: some View {
        Section {
            // Picker button — always visible so the user can add more photos
            PhotosPicker(
                selection: $selectedPhotoItems,
                maxSelectionCount: 5,
                matching: .images,
                photoLibrary: .shared()
            ) {
                Label(
                    selectedImages.isEmpty
                        ? "Add Photos of Your Junk"
                        : "Change Photos (\(selectedImages.count)/5)",
                    systemImage: "camera.fill"
                )
                .frame(maxWidth: .infinity, alignment: .center)
                .foregroundStyle(.green)
            }
            // Only show the grid once photos are chosen
            .onChange(of: selectedPhotoItems) { _, newItems in
                loadImages(from: newItems)
            }

            if !selectedImages.isEmpty {
                photoThumbnailRow
            }
        } header: {
            Text("Junk Photos")
        } footer: {
            Text("Upload up to 5 photos so we can give you an accurate quote.")
                .font(.footnote)
        }
    }

    /// Horizontal scrolling row of selected photo thumbnails with remove buttons.
    private var photoThumbnailRow: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 10) {
                ForEach(Array(selectedImages.enumerated()), id: \.offset) { index, image in
                    ZStack(alignment: .topTrailing) {
                        Image(uiImage: image)
                            .resizable()
                            .scaledToFill()
                            .frame(width: 110, height: 110)
                            .clipShape(RoundedRectangle(cornerRadius: 10))
                            .shadow(radius: 2)

                        // Remove button
                        Button {
                            removePhoto(at: index)
                        } label: {
                            Image(systemName: "xmark.circle.fill")
                                .symbolRenderingMode(.palette)
                                .foregroundStyle(.white, .black.opacity(0.7))
                                .font(.title3)
                        }
                        .padding(4)
                    }
                }
            }
            .padding(.vertical, 4)
        }
    }

    private var notesSection: some View {
        Section("Notes (optional)") {
            TextField("Describe the items, heavy furniture, stairs, etc.", text: $notes, axis: .vertical)
                .lineLimit(3...6)
        }
    }

    // MARK: - Photo Helpers

    /// Loads `UIImage` values from the picker items and updates `selectedImages`.
    private func loadImages(from items: [PhotosPickerItem]) {
        selectedImages = []
        for item in items {
            item.loadTransferable(type: Data.self) { result in
                guard case .success(let data) = result,
                      let data,
                      let image = UIImage(data: data) else { return }
                DispatchQueue.main.async {
                    selectedImages.append(image)
                }
            }
        }
    }

    private func removePhoto(at index: Int) {
        guard index < selectedImages.count else { return }
        selectedImages.remove(at: index)
        if index < selectedPhotoItems.count {
            selectedPhotoItems.remove(at: index)
        }
    }

    // MARK: - Validation

    private var isFormValid: Bool {
        !customerName.trimmingCharacters(in: .whitespaces).isEmpty &&
        !customerPhone.trimmingCharacters(in: .whitespaces).isEmpty &&
        !serviceAddress.trimmingCharacters(in: .whitespaces).isEmpty
    }

    // MARK: - Save

    private func populateIfEditing() {
        guard let appt = existingAppointment else { return }
        customerName   = appt.customerName
        customerPhone  = appt.customerPhone
        serviceAddress = appt.serviceAddress
        scheduledDate  = appt.scheduledDate
        notes          = appt.notes
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
                serviceAddress: serviceAddress.trimmingCharacters(in: .whitespaces),
                scheduledDate: scheduledDate,
                photoURLs: uploadedURLs,
                notes: notes,
                status: existingAppointment?.status ?? .pending,
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
