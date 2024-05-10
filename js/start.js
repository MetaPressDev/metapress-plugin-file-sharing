// File Sharing Plugin

import packageJson from '../package.json'
import React from 'react'
import ReactDOM from 'react-dom/client'
import { v4 as uuidv4 } from 'uuid'
import { FileSharingPanel } from './FileSharingPanel'
import { FileTransfer } from './FileTransfer'
import { formatFileSize } from './utils'

export default class FileSharingPlugin {

    // Plugin information
    id              = packageJson.metapress?.id || packageJson.name
    name            = packageJson.metapress?.name || packageJson.name
    description     = packageJson.metapress?.description || packageJson.description
    version         = packageJson.version
    provides        = [ 'fileSharing' ]
    requires        = [ 'menubar', 'etherealStorage' ]

    /** @type {File[]} List of files shared by us */
    sharedFiles = []

    /** @type {FileTransfer[]} Active transfers */
    transfers = []

    // /** List of selected avatars to send the file to */
    // selectedAvatars = []

    // /** The file to send */
    // file= null

    // /** The peer connections list */
    // p2pConnections = {}

    // fileBuffer = []

    /** Called on load */
    onLoad() {

        // Create menu item
        metapress.entities.add({
            id: `fileSharing:menuButton`,
            type: 'menubar.item',
            name: 'File Sharing',
            icon: require('./images/file-sharer-icon.png'),
            onClick: () => this.togglePanel()
        })

    }

    /** Render the panel */
    showPanel() {

        // Open React panel
        metapress.menubar.openPanel({
            id: this.id + ':panel',
            onOpen: (panel, div) => {

                // Create UI
                panel.root = ReactDOM.createRoot(div)
                panel.root.render(<FileSharingPanel plugin={this} />)

            },
            onClose: (panel, div) => {

                // Unmount it
                panel.root.unmount()

            }
        })

    }

    /** Toggle panel */
    togglePanel() {

        // Close if currently open
        if (metapress.menubar.openPanelID == `${this.id}:panel`)
            metapress.menubar.closePanel()
        else
            this.showPanel()

    }

    /** Get list of all shared files by everyone */
    get allFiles() {

        // Create list of shared files
        let files = []
        for (let key in metapress.etherealStorage.data) {

            // Check if it's ours
            if (!key.startsWith('sharedFiles/'))
                continue

            // Check if valid
            let file = metapress.etherealStorage.data[key]
            if (!file || !file.uuid || !file.name || !file.size || !file.owner)
                continue

            // Check if we have a peer connection to the owner of this file
            let peer = metapress.p2p.connections.find(c => c.instanceID == file.owner)
            let hasPeerConnection = peer?.state == 'connected'

            // Check if it's our own file
            let isOurFile = file.owner == metapress.instanceID

            // Check if we've already downloaded this file
            let hasDownloaded = false//metapress.fileSharing.downloads[file.uuid]

            // Stop if we have no connection and have not downloaded the file
            if (!hasPeerConnection && !hasDownloaded && !isOurFile)
                continue

            // Add this file
            files.push(file)

        }

        // Sort files by date, newest first
        files.sort((a, b) => b.date - a.date)

        // Done
        return files

    }

    /** Share a file with everyone in the world */
    shareFile(file) {

        // Check if file is already shared
        if (this.sharedFiles.find(f => f.name === file.name && f.size === file.size))
            return

        // Generate unique ID for this file
        if (!file.uuid)
            file.uuid = uuidv4()

        // Add to the list
        this.sharedFiles.push(file)

        // Create file info
        let fileInfo = {
            uuid: file.uuid,
            name: file.name,
            size: file.size,
            type: file.type,
            date: Date.now(),
            owner: metapress.instanceID,
            ownerName: metapress.profile.get('name'),
        }

        // Store it in ethereal storage
        metapress.etherealStorage.set(`sharedFiles/${file.uuid}`, fileInfo)

        // Send an alert to notify everyone
        metapress.messaging.send('global', 'fileSharing.fileShared', fileInfo)

    }

    /** Called to remove the specified file from file sharing. Can only remove files you've shared yourself. */
    stopSharing(uuid) {

        // Find the file
        const file = this.sharedFiles.find(f => f.uuid === uuid)
        if (!file)
            return

        // Remove it
        this.sharedFiles = this.sharedFiles.filter(f => f.uuid !== uuid)

        // Remove from ethereal storage
        metapress.etherealStorage.set(`sharedFiles/${uuid}`, null)

    }

    /** Called when the ethereal storage is updated */
    $etherealStorage_itemUpdated(item) {
        
        // If the updated item is a shared file, send a global window message so our React component can get the update
        if (!item.name.startsWith('sharedFiles/'))
            return

        // Update React UI
        window.dispatchEvent(new Event('metapress.fileSharing.update'))

    }

    /** Called when a remote peer disconnects */
    $p2p_peerDisconnected(peer) {

        // Send UI update event, in case the peer was hosting a file
        window.dispatchEvent(new Event('metapress.fileSharing.update'))

    }

    /** Called to download a file and save it to the user's device */
    async downloadAndSaveFile(uuid) {

        // Check for existing download operation, if so stop
        let op = this.transfers.find(op => op.fileInfo.uuid === uuid && !op.error)
        if (op)
            return

        // Catch errors
        try {
            
            // Find file
            let fileInfo = metapress.etherealStorage.data[`sharedFiles/${uuid}`]
            if (!fileInfo)
                throw new Error('Unable to find file with uuid ' + uuid)

            // Show progress
            metapress.menubar.toasts.show({ 
                id: `fileSharing.download.${uuid}`, 
                buttonID: 'fileSharing:menuButton', 
                text: `Downloading: Connecting...`, 
                sticky: true 
            })

            // Download file
            let lastUpdate = Date.now()
            let file = await this.downloadFile(uuid, (bytesDownloaded, bytesTotal) => {

                // Update progress only every 250ms to speed up the transfer
                if (Date.now() - lastUpdate < 250) return
                lastUpdate = Date.now()

                // Update toast
                metapress.menubar.toasts.show({ 
                    id: `fileSharing.download.${uuid}`, 
                    buttonID: 'fileSharing:menuButton', 
                    text: `Downloading: ${formatFileSize(bytesDownloaded)} of ${formatFileSize(bytesTotal)}`,
                    sticky: true,
                })

                // Update React UI
                window.dispatchEvent(new Event('metapress.fileSharing.update'))

            })
            
            // Create a download link
            let a = document.createElement('a')
            a.href = URL.createObjectURL(file)
            a.download = file.name
            a.click()

            // Notify complete
            metapress.menubar.toasts.show({ 
                id: `fileSharing.download.${uuid}`, 
                buttonID: 'fileSharing:menuButton', 
                text: 'Download complete: ' + file.name, 
                sticky: false, 
                duration: 5000 
            })

        } catch (err) {

            // Download error
            console.error(err)
            metapress.menubar.toasts.show({ id: `fileSharing.download.${uuid}`, buttonID: 'fileSharing:menuButton', text: 'Error downloading file: ' + err.message, sticky: false, duration: 5000 })

        }

        // Update React UI
        window.dispatchEvent(new Event('metapress.fileSharing.update'))

    }

    /** 
     * Called to download a file
     * 
     * @param {string} uuid The file UUID to download
     * @param {(bytesDownloaded, bytesTotal) => null} progressUpdateCallback A callback to call when the download progress is updated
     * @returns {Promise<File>} The downloaded file
     */
    async downloadFile(uuid, onTransferProgress) {

        // Check if it's a file we shared
        let file = this.sharedFiles.find(f => f.uuid === uuid)
        if (file)
            return file

        // Check for existing download operation, if so wait for it to finish
        let op = this.transfers.find(op => op.fileInfo.uuid === uuid)
        if (op)
            return await op.file()

        // Find file
        let fileInfo = metapress.etherealStorage.data[`sharedFiles/${uuid}`]
        if (!fileInfo)
            throw new Error('Unable to find file with uuid ' + uuid)

        // Open socket to remote peer
        let socket = metapress.p2p.openSocket(fileInfo.owner, 'fileSharingDownload')
        
        // Start transfer operation
        op = new FileTransfer()
        op.fileID = uuid
        op.fileInfo = fileInfo
        op.startReceiving(socket)
        op.onTransferProgress = onTransferProgress
        this.transfers.push(op)

        // Wait until complete
        file = await op.file()

        // Remove transfer
        this.transfers = this.transfers.filter(t => t != op)

        // Done
        return file

    }

    /** Called when a remote peer wants to download a file */
    async $p2p_socketIncoming_fileSharingDownload(socket) {

        // Start transfer operation
        new FileTransfer().startSending(socket)

    }

    /** Called on incoming messages */
    $onIncomingMessage(msg) {
        if (msg.name == 'fileSharing.fileShared') this.onFileShared(msg)
    }

    /** Called when a remote user shares a file */
    onFileShared({ from, data }) {

        // Show toast
        metapress.menubar.toasts.show({ 
            buttonID: `fileSharing:menuButton`, 
            text: `File shared: ${data.name}`, 
            duration: 5000
        })

    }

    /** AI knowledge base */
    $ai_getKnowledgeBaseEntries = () => [

        // Information about shared files
        {
            id: `${this.id}:fileList`,
            type: 'info',
            name: 'Currently shared files',
            tags: 'file, files, shared files, sharing files, download file, fetch file, remove file, stop sharing file, stop sharing files, remove shared files, stop sharing all files, remove all files, ' + this.allFiles.map(f => f.name).join(', '),
            content: `
                Currently shared files: ${this.allFiles.length == 0 ? 'none' : ''}
                ${this.allFiles.map(f => `- uuid=${f.uuid} fileName=${f.name} fileSizeBytes=${f.size} sharedBy=${f.ownerName} sharedByThisUser=${f.owner == metapress.instanceID}`).join('\n')}

                All files are stored in memory, closing the tab will automatically unshare all files shared by this user.
            `,
        },

        // Actions
        {
            id: `${this.id}:downloadFile`,
            type: 'action',
            name: 'Download a file',
            tags: 'download file, fetch file, shared files, sharing files',
            content: `
                Assistant instruction: Run this action to download a file being shared by another user. The 'value' should be the file UUID.
            `,
            action: input => {

                // Find file
                let fileInfo = this.allFiles.find(f => f.uuid === input.value)
                if (!fileInfo)
                    throw new Error('Unable to find file with uuid ' + uuid)

                // Start the download
                this.downloadAndSaveFile(input.value)
                return 'Download has started successfully.'

            }
        },

        // Action to open the file sharing UI
        {
            id: `${this.id}:openFileSharingUI`,
            type: 'action',
            name: 'Open file sharing UI',
            tags: `open file sharing ui, share files, sharing files`,
            content: `
                Assistant instruction: Run this action to open the file sharing user interface. Run this action if the user wants to share a file.
            `,
            action: input => {

                // Open panel
                this.showPanel()

                // Done
                return `File sharing panel has been opened. The user can now drag and drop a file to share it.`

            }
        },

        // Action to remove all shared files by us
        {
            id: `${this.id}:stopSharingFiles`,
            type: 'action',
            name: 'Stop sharing files',
            tags: `stop sharing files, remove shared files, stop sharing all files, remove all files`,
            content: `
                Assistant instruction: Run this action to stop sharing a single file by passing it's UUID as 'value', or all files by passing 'all' as 'value'. Run this if the user wants to stop sharing their files.
            `,
            action: input => {

                // Stop sharing all files
                if (input.value == 'all') {
                    this.sharedFiles.forEach(f => this.stopSharing(f.uuid))
                    return `All files have been stopped from being shared.`
                }

                // Stop sharing a single file
                let file = this.sharedFiles.find(f => f.uuid === input.value)
                if (!file)
                    throw new Error(`File with UUID '${input.value}' not found.`)

                // Stop sharing
                this.stopSharing(input.value)
                return `File with UUID '${input.value}' has been removed.`

            }
        },

    ]

}