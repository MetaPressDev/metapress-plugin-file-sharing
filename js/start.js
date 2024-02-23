// File Sharing Plugin

import packageJson from '../package.json'
import React from 'react'
import SimplePeer from 'simple-peer'
import { v4 as uuidv4 } from 'uuid'

export default class FileSharingPlugin {

    // Plugin information
    id              = packageJson.metapress?.id || packageJson.name
    name            = packageJson.metapress?.name || packageJson.name
    description     = packageJson.metapress?.description || packageJson.description
    version         = packageJson.version
    provides        = [ ]
    requires        = [ 'menubar', 'avatars', 'messaging' ]

    /** List of selected avatars to send the file to */
    selectedAvatars = []

    /** The file to send */
    file= null

    /** The peer connections list */
    p2pConnections = {}

    // fileBuffer = []

    /** Called on load */
    onLoad() {

        // Create menu item
        metapress.entities.add({
            type: 'menubar.item',
            name: 'File Sharing',
            icon: require('./images/file-sharer-icon.png'),
            onClick: () => metapress.menubar.openReactPanel('file-sharing-menu', this.openFileSharePanel)
        })

    }

    // Receive a message
    $onIncomingMessage(msg) {
        if (msg.name == 'fileshare.plugin.signal') {
            console.log('Received Message: ', msg, this.p2pConnections)
        }
    }

    /** Called when user is dragging a file */
    onDragOverHandler = e => {
        e.preventDefault()
        e.dataTransfer.dropEffect = 'copy'
    }

    /** Called when user drop a file */
    onDropHandler = e => {
        e.preventDefault()

        const fileArr = e.dataTransfer.files
        this.handleFiles(fileArr)
    }

    /** Called when file is selected */
    handleFiles = files => {
        // Stop if more than 1 file is uploaded
        if (files.length > 1) {
            metapress.menubar.toasts.show({ id: 'file.sharer.plugin.error', text: 'You can only share one file at a time!' })
            return
        }

        this.file = files[0]

        // if using MQTT to create a new peer connection won't need that
        // const maxFileSize = 16 * 1024 // 16 KB

        // if (this.file.size > maxFileSize) {
        //     this.splitFile(maxFileSize)
        // }

        // close the initial panel and show the send file UI
        metapress.menubar.closePanel()
        metapress.menubar.openReactPanel('file-sharing-sending-menu', this.sendFileUI)
    
    }

    // if using MQTT to create a new peer connection won't need that
    /** Split the file into chunks */
    // async splitFile(maxFileSize) {
    //     const fileReader = new FileReader()
    //     let size = 0

    //     do {
    //         const fileChunk = this.file.slice(size, size + maxFileSize)
    //         const buffer = await fileChunk.arrayBuffer()

    //         const data = { type: 'file', name: this.file.name, size: this.file.size, chunk: Array.from(new Uint8Array(buffer)), size }
    //         this.fileBuffer.push(data)
    //         // increment
    //         size += maxFileSize

    //     } while (size < this.file.size)
        
    // }

    /** Open file sharing panel -> dropzone first */
    openFileSharePanel = () => {
        return <PanelContainer title='File Sharer' onClose={() => metapress.menubar.closePanel() } >

            <div style={{ fontSize: 14, fontWeight: 'bold', margin: '25px 20px' }}> Upload a File: </div>

            {/** create a dropZone */}
            <div id="dropzone" onDragOver={e => this.onDragOverHandler(e)} onDrop={ e => this.onDropHandler(e)} style={{ position: 'absolute', top: 30, margin: '30px 40px', width: 'calc(100% - 90px)', height: '300px', border: '2px dashed #858383', textAlign: 'center', cursor: 'pointer' }} >
                
                <img draggable='false' src={require('./images/upload-file.png')} style={{ width: 40, height: 40, margin: '50px auto 10px auto', justifyContent: 'center' }} />
                
                <div style={{ fontSize: 13, margin: '10px auto', flex: '1 1 1px' }}>
                    Drag & Drop a file <br/>
                    or <br/>
                    <p onClick={() => document.getElementById('file-input').click()} style={{ fontWeight: 'bold', cursor: 'pointer', textDecoration: 'underline', margin: 'auto' }}> Browse a file </p>
                </div>
                
                <input type="file" id="file-input" onChange={e => this.handleFiles(e.target.files)} style={{ display: 'none' }} />
            </div>
        </PanelContainer>
   
    }

    /** Called to update the selected avatars */
    updateSelectedAvatars(avatar, index) {

        // Update checkbox fields
        if (document.getElementById(index).style.backgroundImage.includes('icon-checked')) {
            // uncheck the checkbox
            document.getElementById(index).style.backgroundImage = `url(${require('./images/icon-unchecked.svg')})`
            const sendList = this.selectedAvatars.filter(user => user.avatarID !== avatar.avatarID)
            this.selectedAvatars = sendList
        }
        else {
            // check the checkbox
            document.getElementById(index).style.backgroundImage = `url(${require('./images/icon-checked.svg')})`
            this.selectedAvatars.push(avatar)
        }

    }

    /** Called when the send button is triggered */
    onSendHandler = () => {
        // No users selected
        if (this.selectedAvatars.length === 0) {
            metapress.menubar.toasts.show({ id: 'file.sharer.plugin.no.user', text: 'No users have been selected!' })
            return
        }

        // get the data
        let data = new Blob([this.file], { type: this.file.type, name: this.file.name })

        // Send the file to each of the selected users
        this.selectedAvatars.forEach(avatar => {
            // Generate a unique ID
            const transferID = uuidv4()

            // Create a peer connection using that ID
            this.p2pConnections[transferID] = new SimplePeer({ initiator: true })

            // Add event listeners
            this.p2pConnections[transferID].on('signal', data => {
                // Send it to the remote peer
                metapress.messaging.send(avatar.instanceID, 'fileshare.plugin.signal', {
                    connectionID: transferID,
                    instanceID: metapress.avatars.currentUserEntity.owner,
                    data
                })
            })

            this.p2pConnections[transferID].on('data', data => {
                console.log('[FileSharing Plugin] Data: ', data)

                // use the created peer connection to send the file

            })

            this.p2pConnections[transferID].on('error', (err) => {
                console.error('[FileSharing Plugin] Simple-peer connection error:', err)
            })

            this.p2pConnections[transferID].on('close', () => {
                console.warn('[FileSharing Plugin] Simple-peer connection closed')
                this.p2pConnections[transferID].destroy()
                delete this.p2pConnections[transferID]
            })
            
        
        })

        // Display a toast
        metapress.menubar.toasts.show({ id: 'file.sharer.plugin', text: 'Sharing uploaded file to the selected users!' })

        // Reset 
        this.file = null
        // this.fileBuffer = [] // if using MQTT to create a new peer connection won't need that
        this.selectedAvatars = []

        // Close the panel
        metapress.menubar.closePanel()

    }
    
    /**
     * Send file UI
     */
    sendFileUI = () => {
        return <PanelContainer title='File Sharer' onClose={() => metapress.menubar.closePanel()} >
                {/** Display Uploaded file */}
                <div style={{ display: 'flex', flexDirection: 'row', margin: '20px auto' }}>
                    
                    <img draggable='false' src={require('./images/file.png')} style={{ width: 25, height: 25, margin: '10px 20px' }} />
                    
                    <div style={{ fontSize: 13, margin: '15px auto', flex: '1 1 1px' }}> 
                        { this.file.name } 
                    </div>
                </div>
                
                { metapress.avatars.users.length > 0
                    ? <>
                        <div style={{ fontSize: 14, fontWeight: 'bold', margin: 'auto 20px' }}> 
                            Send To: 
                        </div>

                        {/** List of avatars in the space */}
                        <div style={{ display: 'flex', flexDirection: 'column', margin: '10px 20px' }}>
                            { metapress.avatars.users.map((avatar,ind) => {
                                return <div style={{ display: 'flex', flexDirection: 'row', margin: '10px 20px' }}>
                                
                                    {/** Checkbox */}
                                    <input type='checkbox' id={ind} onChange={() => this.updateSelectedAvatars(avatar,ind)} style={{ margin: 'auto 2px', width: 1, color: 'white', borderRadius: 5,width: 25, height: 25, cursor: 'pointer', backgroundColor: 'rgba(255, 255, 255, 0.1)', backgroundPosition: 'center', backgroundRepeat: 'no-repeat', backgroundSize: '14px 14px', backgroundImage: `url(${require('./images/icon-unchecked.svg')})`, border: '1px solid rgba(255, 255, 255, 0.025)', boxSizing: 'border-box' }} />

                                    {/** Avatar */}
                                    <img draggable='false' src={avatar._avatarEntity.profile_image_src} style={{ width: 30, height: 30, margin: 'auto 15px' }} />
                                    <div style={{fontSize: 13,  margin: 'auto 5px' }}> 
                                        { avatar.metadata.name } 
                                    </div>
                                
                                </div>
                            })}
                        </div>

                        {/** Send file button */}
                        <div onClick={() => this.onSendHandler()} style={{ display: 'flex',  margin: '20px 40px', float: 'right', padding: '8px 12px 8px 12px',color: 'white', backgroundColor: 'rgba(255, 255, 255, 0.1)', cursor: 'pointer', borderRadius: 5, fontSize: 13, flex: '1 1 1px', justifyContent: 'center', alignItems: 'center'}} >
                            Send
                        </div>

                    </>
                    : <div style={{ fontSize: 14, fontWeight: 100, margin: 'auto 20px' }}> 
                        No other users in the space to send the file to.
                    </div>

                }

        </PanelContainer>
    }

}

/** 
 * Container for a panel.
 * @param {object} props Panel container properties.
 * @param {string} props.title The title of the panel.
 * @param {React.ReactNode} props.children The children of the panel.
 * @param {React.CSSProperties=} props.containerStyle Additional styling to apply to the container.
 * @param {Function=} props.onClose Function to execute when the close button is clicked.
 */
export const PanelContainer = props => {

    // Return UI
    return <>
    
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', position: 'absolute', top: 0, left: 0, width: '100%', height: 44, borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>

            {/* Title */}
            <div style={{ fontSize: 15, margin: '0px 20px', flex: '1 1 1px' }}> { props.title } </div>

            {/* Only show close button if there is a close function */}
            { props.onClose != null
                ? <img draggable='false' src={require('./images/close.svg')} title='Close' style={{ width: 20, height: 20, marginRight: 15, cursor: 'pointer' }} onClick={props.onClose} />
                : null
            }

        </div>

        {/* Scrollable content */}
        <div style={{ position: 'absolute', top: 45, left: 0, width: '100%', height: 'calc(100% - 45px)', overflowX: 'hidden', overflowY: 'auto' }} >
            {props.children}
        </div>

    </>

}