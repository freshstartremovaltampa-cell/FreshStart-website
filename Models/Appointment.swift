import Foundation

enum AppointmentStatus: String, Codable, CaseIterable {
    case pending = "Pending"
    case confirmed = "Confirmed"
    case inProgress = "In Progress"
    case completed = "Completed"
    case cancelled = "Cancelled"

    var color: String {
        switch self {
        case .pending:    return "yellow"
        case .confirmed:  return "blue"
        case .inProgress: return "orange"
        case .completed:  return "green"
        case .cancelled:  return "red"
        }
    }
}

enum ServiceType: String, Codable, CaseIterable {
    case fullJunkRemoval   = "Full Junk Removal"
    case applianceRemoval  = "Appliance Removal"
    case furnitureRemoval  = "Furniture Removal"
    case yardDebris        = "Yard Debris Removal"
    case estateCleanout    = "Estate Cleanout"
    case constructionDebris = "Construction Debris"
    case other             = "Other"
}

struct Appointment: Identifiable, Codable {
    var id: String
    var customerName: String
    var customerPhone: String
    var customerEmail: String
    var serviceAddress: String
    var serviceType: ServiceType
    var scheduledDate: Date
    var estimatedDuration: Int       // minutes
    var photoURLs: [String]
    var notes: String
    var status: AppointmentStatus
    var estimatedCost: Double?
    var createdAt: Date
    var updatedAt: Date

    init(
        id: String = UUID().uuidString,
        customerName: String = "",
        customerPhone: String = "",
        customerEmail: String = "",
        serviceAddress: String = "",
        serviceType: ServiceType = .fullJunkRemoval,
        scheduledDate: Date = Date(),
        estimatedDuration: Int = 120,
        photoURLs: [String] = [],
        notes: String = "",
        status: AppointmentStatus = .pending,
        estimatedCost: Double? = nil,
        createdAt: Date = Date(),
        updatedAt: Date = Date()
    ) {
        self.id = id
        self.customerName = customerName
        self.customerPhone = customerPhone
        self.customerEmail = customerEmail
        self.serviceAddress = serviceAddress
        self.serviceType = serviceType
        self.scheduledDate = scheduledDate
        self.estimatedDuration = estimatedDuration
        self.photoURLs = photoURLs
        self.notes = notes
        self.status = status
        self.estimatedCost = estimatedCost
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }

    var formattedDate: String {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .short
        return formatter.string(from: scheduledDate)
    }

    var formattedCost: String {
        guard let cost = estimatedCost else { return "TBD" }
        return String(format: "$%.2f", cost)
    }
}
