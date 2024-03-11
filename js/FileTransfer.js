import { v4 as uuidv4 } from 'uuid'
import { formatFileSize } from './utils'

/**
 * Handles opening a connection and transferring a file.
 */
export class FileTransfer {

    /** Transfer ID */
    transferID = uuidv4()

    /** File ID */
    fileID = ''

    /** True if sending, false if receiving */
    isSending = false

    /** @type {File} File */
    _file = null

    /** Transfer progress */
    error = null
    transferredBytes = 0
    totalBytes = 0

    /** Info about the file being transferred */
    fileInfo = null

    /**
     * Callback for transfer progress
     * 
     * @type {(bytesTransferred: number, bytesTotal: number) => void}
     */
    onTransferProgress = null

    /** 
     * Wait until the transfer is complete, then return the file 
     * 
     * @returns {Promise<File>} The transferred file.
     */
    async file() {

        // Start loop
        while (true) {

            // Check if file exists
            if (this._file)
                return this._file

            // Check for error
            if (this.error)
                throw this.error

            // Wait a bit
            await new Promise(resolve => setTimeout(resolve, 500))

        }

    }

    /** Start receiving the file */
    async startReceiving(socket) {

        // Stop if already started
        if (this._hasStarted) return
        this._hasStarted = true

        // We are receiving
        this.isSending = false

        // Get reader and writer
        console.debug(`[FileSharing] Opening connection to receive file ${this.fileID}...`)
        let reader = socket.readableStream.getReader()
        let writer = socket.writableStream.getWriter()

        // Catch errors
        try {

            // Send the file request
            await writer.write({ action: 'requestFile', fileID: this.fileID })

            // Receive response
            let response = await reader.read()
            if (!response.value) throw new Error('Connection closed unexpectedly.')
            if (response.value.error) throw new Error(response.value.error)

            // Store total bytes
            this.totalBytes = response.value.totalBytes

            // Start storing file parts
            let parts = []
            while (this.transferredBytes < this.totalBytes) {

                // Receive data
                let data = await reader.read()
                if (!data.value)
                    throw new Error('Connection closed unexpectedly.')

                // Store it
                parts.push(data.value)
                this.transferredBytes += data.value.byteLength

                // Show toast progress
                this.onTransferProgress?.(this.transferredBytes, this.totalBytes)

            }

            // Done!
            this._file = new File(parts, this.fileInfo.name, { type: this.fileInfo.type })
            console.debug('File received successfully.', this._file)

        } catch (err) {

            // Connection failed
            console.error(`[FileTransfer] Failed to receive file:`, err)
            this.error = err

        }

        // Complete
        reader.releaseLock()
        writer.releaseLock()
        socket.close()

    }

    /** Start sending the file */
    async startSending(socket) {

        // Stop if already started
        if (this._hasStarted) return
        this._hasStarted = true

        // We are receiving
        this.isSending = false

        // Get reader and writer
        console.debug(`[FileSharing] Opening connection to send file ${this.fileID}...`)
        let reader = socket.readableStream.getReader()
        let writer = socket.writableStream.getWriter()

        // Catch errors
        try {

            // Wait for incoming request
            let request = await reader.read()
            if (!request?.value?.fileID)
                throw new Error('Socket closed unexpectedly.')
            
            // Get file info
            this.fileID = request.value.fileID
            this.file = metapress.fileSharing.sharedFiles.find(f => f.uuid === request.value.fileID)
            if (!this.file) {
                await writer.write({ error: 'File not found.' })
                throw new Error('File not found.')
            }

            // Send file info
            let bytes = await this.file.arrayBuffer()
            await writer.write({ totalBytes: bytes.byteLength })

            // Send file in 1KB chunks (unfortunate maximum WebRTC packet size)
            let chunkSize = 1024
            for (let offset = 0 ; offset < bytes.byteLength ; offset += chunkSize) {

                // Send next chunk
                let chunk = bytes.slice(offset, offset + chunkSize)
                await writer.write(chunk)
                this.transferredBytes += chunk.byteLength

                // Show progress
                this.onTransferProgress?.(this.transferredBytes, bytes.byteLength)

            }

            // Wait for remote side to close the connection
            while (true)
                if ((await reader.read()).done)
                    break

            // Complete
            console.debug(`[FileSharing] File sent successfully.`)

        } catch (err) {

            // Connection failed
            console.error(`[FileTransfer] Failed to send file:`, err)
            this.error = err

        }

        // Complete
        reader.releaseLock()
        writer.releaseLock()
        socket.close()

    }

}