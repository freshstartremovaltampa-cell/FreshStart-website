import SwiftUI
import PhotosUI

struct PhotoGridView: View {
    @Binding var selectedItems: [PhotosPickerItem]
    @Binding var displayImages: [UIImage]
    var uploadProgress: Double = 0

    private let columns = [GridItem(.adaptive(minimum: 100, maximum: 130), spacing: 8)]

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Photos")
                    .font(.headline)
                Spacer()
                PhotosPicker(
                    selection: $selectedItems,
                    maxSelectionCount: 10,
                    matching: .images
                ) {
                    Label("Add", systemImage: "plus.circle.fill")
                        .font(.subheadline)
                        .foregroundStyle(.green)
                }
            }

            if displayImages.isEmpty {
                emptyState
            } else {
                imageGrid
            }

            if uploadProgress > 0 {
                ProgressView(value: uploadProgress) {
                    Text("Uploading \(Int(uploadProgress * 100))%")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                .tint(.green)
            }
        }
        .onChange(of: selectedItems) { _, newItems in
            loadImages(from: newItems)
        }
    }

    private var emptyState: some View {
        PhotosPicker(
            selection: $selectedItems,
            maxSelectionCount: 10,
            matching: .images
        ) {
            RoundedRectangle(cornerRadius: 12)
                .stroke(Color.secondary.opacity(0.4), style: StrokeStyle(lineWidth: 1.5, dash: [6]))
                .frame(height: 100)
                .overlay {
                    VStack(spacing: 6) {
                        Image(systemName: "camera.fill")
                            .font(.title2)
                            .foregroundStyle(.secondary)
                        Text("Tap to add photos")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                }
        }
    }

    private var imageGrid: some View {
        LazyVGrid(columns: columns, spacing: 8) {
            ForEach(Array(displayImages.enumerated()), id: \.offset) { index, image in
                ZStack(alignment: .topTrailing) {
                    Image(uiImage: image)
                        .resizable()
                        .scaledToFill()
                        .frame(width: 100, height: 100)
                        .clipShape(RoundedRectangle(cornerRadius: 8))

                    Button {
                        removeImage(at: index)
                    } label: {
                        Image(systemName: "xmark.circle.fill")
                            .foregroundStyle(.white, .black)
                            .padding(4)
                    }
                }
            }
        }
    }

    private func loadImages(from items: [PhotosPickerItem]) {
        displayImages = []
        for item in items {
            item.loadTransferable(type: Data.self) { result in
                guard case .success(let data) = result,
                      let data, let image = UIImage(data: data) else { return }
                DispatchQueue.main.async {
                    displayImages.append(image)
                }
            }
        }
    }

    private func removeImage(at index: Int) {
        guard index < displayImages.count else { return }
        displayImages.remove(at: index)
        if index < selectedItems.count {
            selectedItems.remove(at: index)
        }
    }
}
