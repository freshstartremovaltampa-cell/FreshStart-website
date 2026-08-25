import SwiftUI

struct MainDashboardView: View {
    @StateObject private var viewModel = AppointmentViewModel()
    @State private var showBookingSheet = false
    @State private var selectedAppointment: Appointment?

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    todaySection
                    upcomingSection
                }
                .padding()
            }
            .background(Color(.systemGroupedBackground))
            .navigationTitle("FreshStart Dashboard")
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    Button {
                        showBookingSheet = true
                    } label: {
                        Image(systemName: "plus")
                    }
                }
            }
            .sheet(isPresented: $showBookingSheet) {
                AppointmentBookingView(viewModel: viewModel)
            }
            .sheet(item: $selectedAppointment) { appointment in
                AppointmentBookingView(viewModel: viewModel, appointment: appointment)
            }
            .task {
                await viewModel.fetchAppointments()
            }
            .overlay {
                if viewModel.isLoading && viewModel.appointments.isEmpty {
                    ProgressView("Loading jobs…")
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                        .background(.ultraThinMaterial)
                }
            }
        }
    }

    // MARK: - Sections

    private var todaySection: some View {
        VStack(alignment: .leading, spacing: 12) {
            sectionHeader("Today", count: viewModel.todayAppointments.count)

            if viewModel.todayAppointments.isEmpty {
                emptyCard(message: "No jobs scheduled today.")
            } else {
                ForEach(viewModel.todayAppointments) { appointment in
                    AppointmentCard(appointment: appointment)
                        .onTapGesture { selectedAppointment = appointment }
                }
            }
        }
    }

    private var upcomingSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            sectionHeader("Upcoming", count: viewModel.upcomingAppointments.count)

            if viewModel.upcomingAppointments.isEmpty {
                emptyCard(message: "No upcoming jobs.")
            } else {
                ForEach(viewModel.upcomingAppointments) { appointment in
                    AppointmentCard(appointment: appointment)
                        .onTapGesture { selectedAppointment = appointment }
                }
            }
        }
    }

    // MARK: - Helpers

    private func sectionHeader(_ title: String, count: Int) -> some View {
        HStack {
            Text(title)
                .font(.title2)
                .fontWeight(.bold)
            Text("\(count)")
                .font(.caption)
                .fontWeight(.semibold)
                .foregroundStyle(.secondary)
                .padding(.horizontal, 8)
                .padding(.vertical, 2)
                .background(Color(.systemFill))
                .clipShape(Capsule())
        }
    }

    private func emptyCard(message: String) -> some View {
        Text(message)
            .font(.subheadline)
            .foregroundStyle(.secondary)
            .frame(maxWidth: .infinity)
            .padding()
            .background(Color(.secondarySystemGroupedBackground))
            .clipShape(RoundedRectangle(cornerRadius: 12))
    }
}

// MARK: - Appointment Card

struct AppointmentCard: View {
    let appointment: Appointment

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text(appointment.customerName)
                        .font(.headline)
                    Text(appointment.serviceType.rawValue)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
                Spacer()
                StatusBadge(status: appointment.status)
            }

            Divider()

            HStack(spacing: 16) {
                Label(appointment.formattedDate, systemImage: "calendar")
                    .font(.caption)
                    .foregroundStyle(.secondary)

                Spacer()

                if appointment.estimatedCost != nil {
                    Label(appointment.formattedCost, systemImage: "dollarsign.circle")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }

            Label(appointment.serviceAddress, systemImage: "mappin.and.ellipse")
                .font(.caption)
                .foregroundStyle(.secondary)
                .lineLimit(1)
        }
        .padding()
        .background(Color(.secondarySystemGroupedBackground))
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }
}
