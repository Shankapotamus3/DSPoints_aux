import { useState } from "react";
import type { ReactNode } from "react";
import Uppy from "@uppy/core";
import { DashboardModal } from "@uppy/react";
import "@uppy/core/dist/style.min.css";
import "@uppy/dashboard/dist/style.min.css";
import AwsS3 from "@uppy/aws-s3";
import type { UploadResult } from "@uppy/core";
import { Button } from "@/components/ui/button";

interface ObjectUploaderProps {
  maxNumberOfFiles?: number;
  maxFileSize?: number;
  onGetUploadParameters: () => Promise<{
    method: "PUT";
    url: string;
    cloudinaryParams?: {
      apiKey: string;
      timestamp: number;
      signature: string;
      folder: string;
    };
    storageType?: string;
  }>;
  onComplete?: (
    result: UploadResult<Record<string, unknown>, Record<string, unknown>>
  ) => void;
  buttonClassName?: string;
  children: ReactNode;
}

/**
 * A file upload component that renders as a button and provides a modal interface for
 * file management.
 * 
 * Features:
 * - Renders as a customizable button that opens a file upload modal
 * - Provides a modal interface for:
 *   - File selection
 *   - File preview
 *   - Upload progress tracking
 *   - Upload status display
 * 
 * The component uses Uppy under the hood to handle all file upload functionality.
 * All file management features are automatically handled by the Uppy dashboard modal.
 * 
 * @param props - Component props
 * @param props.maxNumberOfFiles - Maximum number of files allowed to be uploaded
 *   (default: 1)
 * @param props.maxFileSize - Maximum file size in bytes (default: 10MB)
 * @param props.onGetUploadParameters - Function to get upload parameters (method and URL).
 *   Typically used to fetch a presigned URL from the backend server for direct-to-S3
 *   uploads.
 * @param props.onComplete - Callback function called when upload is complete. Typically
 *   used to make post-upload API calls to update server state and set object ACL
 *   policies.
 * @param props.buttonClassName - Optional CSS class name for the button
 * @param props.children - Content to be rendered inside the button
 */
export function ObjectUploader({
  maxNumberOfFiles = 1,
  maxFileSize = 10485760, // 10MB default
  onGetUploadParameters,
  onComplete,
  buttonClassName,
  children,
}: ObjectUploaderProps) {
  const [showModal, setShowModal] = useState(false);
  const [uppy] = useState(() =>
    new Uppy({
      restrictions: {
        maxNumberOfFiles,
        maxFileSize,
        allowedFileTypes: ['image/*'], // Only allow images for avatars
      },
      autoProceed: false,
      debug: true, // Enable debug mode to see what's happening
    })
      .use(AwsS3, {
        shouldUseMultipart: false,
        getUploadParameters: async (file) => {
          console.log("📡 Getting upload parameters for:", file.name);
          const params = await onGetUploadParameters();
          console.log("📥 Received params:", params);
          
          // Check if this is a Cloudinary upload (has cloudinaryParams)
          if ('cloudinaryParams' in params && params.cloudinaryParams) {
            const { cloudinaryParams } = params as any;
            console.log("☁️ Using Cloudinary upload");
            return {
              method: 'POST',
              url: params.url,
              fields: {
                api_key: cloudinaryParams.apiKey,
                timestamp: cloudinaryParams.timestamp,
                signature: cloudinaryParams.signature,
                folder: cloudinaryParams.folder,
              },
              headers: {},
            };
          }
          
          // Regular upload (Replit object storage) - store the signed URL
          console.log("📦 Using Replit object storage upload");
          file.meta.signedUploadURL = params.url;
          return params;
        },
      })
      .on("upload", () => {
        console.log("🚀 Upload started");
      })
      .on("upload-success", (file, response) => {
        console.log("✅ Upload success:", file?.name, response);
        console.log("File object:", file);
        
        // Cloudinary returns the URL in response.body.secure_url
        if (response && response.body && response.body.secure_url) {
          console.log("☁️ Cloudinary URL:", response.body.secure_url);
        } else if (file?.meta?.signedUploadURL) {
          // For Replit storage, extract clean URL from signed URL
          const signedUrl = file.meta.signedUploadURL as string;
          console.log("📦 Signed URL:", signedUrl);
          const urlObj = new URL(signedUrl);
          const cleanUrl = urlObj.origin + urlObj.pathname;
          file.uploadURL = cleanUrl;
          console.log("📦 Clean Replit storage URL:", cleanUrl);
        }
      })
      .on("upload-error", (file, error) => {
        console.error("❌ Upload error:", file?.name, error);
      })
      .on("error", (error) => {
        console.error("❌ Uppy error:", error);
      })
      .on("complete", (result) => {
        console.log("🏁 Upload complete, full result:", result);
        console.log("🏁 Successful files:", result.successful);
        console.log("🏁 Failed files:", result.failed);
        if (onComplete) {
          console.log("🏁 Calling onComplete callback");
          onComplete(result);
        } else {
          console.log("⚠️ No onComplete callback provided");
        }
        setShowModal(false); // Close modal after upload
      })
  );

  return (
    <div>
      <Button type="button" onClick={() => setShowModal(true)} className={buttonClassName} data-testid="button-upload-avatar">
        {children}
      </Button>

      <DashboardModal
        uppy={uppy}
        open={showModal}
        onRequestClose={() => setShowModal(false)}
        proudlyDisplayPoweredByUppy={false}
        note="Select an image file, then click Upload"
        showProgressDetails={true}
        showRemoveButtonAfterComplete={true}
      />
    </div>
  );
}